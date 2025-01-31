const fs = require('fs');
const path = require('path');

const PLUGINS_SRC = path.join('source', 'plugins');
const PLUGINS_DEST = path.join('dist', 'plugins');
const INDEX_FILE = path.join('dist', 'plugins-index.json');

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

function processPlugins() {
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

    fs.writeFileSync(
      INDEX_FILE,
      JSON.stringify({ plugins }, null, 2),
      'utf8'
    );
    
    console.log('Successfully packed plugins');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

processPlugins();
