const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const PLUGINS_SRC = path.join('source', 'plugins');
const PLUGINS_DEST = path.join('dist', 'plugins');
const INDEX_FILE = path.join('dist', 'plugins-index.json');
const SHELL_DLL_DIR = path.join(__dirname, 'shell');

function parseMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const metadata = {};
  let inMetadata = true;

  content.split('\n').forEach(line => {
    if (!inMetadata) return;
    
    line = line.trim();
    if (!line.startsWith('//')) {
      inMetadata = false;
      return;
    }

    const match = line.match(/\/\/\s*@(\w+):\s*(.*)/);
    if (match) {
      const key = match[1].toLowerCase();
      metadata[key] = match[2].trim();
    }
  });

  return metadata;
}

function validateMetadata(metadata, filename) {
  const required = ['name', 'version'];
  for (const field of required) {
    if (!metadata[field]) {
      console.error(`[ERROR] ${filename}: Missing required field '${field}'`);
      return false;
    }
  }

  if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
    console.error(`[ERROR] ${filename}: Invalid version format '${metadata.version}'`);
    return false;
  }

  return true;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function fetchLatestRelease() {
  const repoUrl = 'https://api.github.com/repos/std-microblock/b-shell/releases/latest';
  return new Promise((resolve, reject) => {
    https.get(repoUrl, { headers: { 'User-Agent': 'Node.js' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          if (!release.assets) {
            throw new Error('No assets found in the latest release');
          }
          resolve(release);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function processShellDll() {
  try {
    const release = await fetchLatestRelease();
    if (!release.assets) {
      throw new Error('No assets found in the latest release');
    }

    const asset = release.assets.find(a => a.name === 'windows-build.zip');
    if (!asset) {
      throw new Error('windows-build.zip not found in latest release');
    }

    const zipPath = path.join(SHELL_DLL_DIR, 'windows-build.zip');
    fs.mkdirSync(SHELL_DLL_DIR, { recursive: true });

    console.log('Downloading windows-build.zip...');
    await downloadFile(asset.browser_download_url, zipPath);

    // 检查文件是否下载完整
    const fileStats = fs.statSync(zipPath);
    if (fileStats.size !== asset.size) {
      throw new Error('Downloaded file size does not match expected size');
    }

    // 检查文件是否为有效的 ZIP 文件
    try {
      execSync(`file "${zipPath}" | grep "Zip archive data"`);
    } catch {
      throw new Error('Downloaded file is not a valid ZIP archive');
    }

    console.log('Extracting windows-build.zip...');
    execSync(`unzip -o "${zipPath}" -d "${SHELL_DLL_DIR}"`);

    const dllPath = path.join(SHELL_DLL_DIR, 'shell.dll');
    const newDllPath = path.join(__dirname, `shell-${release.tag_name}.dll`);
    fs.renameSync(dllPath, newDllPath);

    console.log(`Shell DLL renamed to shell-${release.tag_name}.dll`);

    return {
      version: release.tag_name,
      path: `/shell-${release.tag_name}.dll`,
      changelog: release.body || ''
    };
  } catch (error) {
    console.error('Error processing shell DLL:', error);
    process.exit(1);
  }
}

async function processPlugins() {
  const plugins = [];
  
  try {
    fs.mkdirSync(PLUGINS_DEST, { recursive: true });
    
    fs.readdirSync(PLUGINS_SRC)
      .filter(f => f.endsWith('.js'))
      .forEach(filename => {
        const srcPath = path.join(PLUGINS_SRC, filename);
        const metadata = parseMetadata(srcPath);

        if (!validateMetadata(metadata, filename)) return;

        const cleanName = metadata.name
          .replace(/[^a-zA-Z0-9\u4e00-\u9FA5]/g, '-')
          .replace(/-+/g, '-');
        
        const newFilename = `${cleanName}-v${metadata.version}.js`;
        const destPath = path.join(PLUGINS_DEST, newFilename);

        fs.copyFileSync(srcPath, destPath);
        
        plugins.push({
          name: metadata.name,
          description: metadata.description || '',
          lang: metadata.lang || 'zh',
          version: metadata.version,
          author: metadata.author || '',
          path: `/plugins/${newFilename}`,
          local_path: metadata.name + '.js'
        });
      });

    const shellInfo = await processShellDll();

    const indexContent = {
      plugins,
      shell: {
        version: shellInfo.version,
        path: shellInfo.path,
        changelog: shellInfo.changelog
      }
    };

    fs.writeFileSync(
      INDEX_FILE,
      JSON.stringify(indexContent, null, 2),
      'utf8'
    );
    
    console.log('Successfully packed plugins and processed shell DLL');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

processPlugins();
