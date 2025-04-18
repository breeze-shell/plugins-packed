// @name: 右键菜单清理
// @description: 多功能、可配置的右键菜单清理工具
// @author: MicroBlock
// @version: 0.0.1
// @lang: zh

import * as shell from "mshell"
import { setTimeout } from "qjs:os"
const ICON_CHECKED = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 12 12"><path fill="currentColor" d="M9.765 3.205a.75.75 0 0 1 .03 1.06l-4.25 4.5a.75.75 0 0 1-1.075.015L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.705 1.704l3.72-3.939a.75.75 0 0 1 1.06-.03"/></svg>`
const ICON_EMPTY = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 12 12"></svg>`
setTimeout(() => {
    const config_name = "contextmenu-cleaner.json"
    const default_config = {
        merge: {
            open_with: true,
            view_operation: true,
            uncommon: true
        }
    }
    let config = {};
    const read_config = () => {
        const config_dir = shell.breeze.data_directory() + '/config/'
        shell.fs.mkdir(config_dir)
        if (shell.fs.exists(config_dir + config_name)) {
            try {
                config = JSON.parse(shell.fs.read(config_dir + config_name))
            } catch (e) {
                shell.println('[右键菜单清理] 配置文件解析失败', e)
            }
        }
    }

    read_config()

    const read_config_key = key => {
        const read = (keys, obj) => {
            if (keys.length === 1) {
                return obj[keys[0]]
            }
            if (!obj[keys[0]]) {
                return undefined
            }
            return read(keys.slice(1), obj[keys[0]])
        }

        return read(key.split('.'), config) ?? read(key.split('.'), default_config)
    }

    const write_config = () => {
        const config_dir = shell.breeze.data_directory() + '/config/'
        shell.fs.mkdir(config_dir)
        shell.fs.write(config_dir + config_name, JSON.stringify(config, null, 4))
    }

    const write_config_key = (key, value) => {
        const write = (keys, obj, value) => {
            if (keys.length === 1) {
                obj[keys[0]] = value
                return
            }
            if (!obj[keys[0]]) {
                obj[keys[0]] = {}
            }
            write(keys.slice(1), obj[keys[0]], value)
        }

        write(key.split('.'), config, value)
        write_config()
    }

    on_plugin_menu["右键菜单清理"] = ((menu) => {
        const createToggleMenu = (menu, name, configKey) => {
            const menuItem = menu.append_menu({
                name,
                action() {
                    write_config_key(configKey, !read_config_key(configKey))
                    menuItem.set_data({
                        icon_svg: read_config_key(configKey) ? ICON_CHECKED : ICON_EMPTY
                    })
                },
                icon_svg: read_config_key(configKey) ? ICON_CHECKED : ICON_EMPTY
            })
            return menuItem
        }

        createToggleMenu(menu, '合并 "用...打开"', 'merge.open_with')
        createToggleMenu(menu, '合并视图操作', 'merge.view_operation')
        createToggleMenu(menu, '合并不常用菜单', 'merge.uncommon')
    })

    shell.menu_controller.add_menu_listener(ctx => {
        try {
            const mergedMenus = []
            const mergeMenuItems = (menuItems, newMenuName) => {
                const items = menuItems.filter(menu => menu)
                if (items.length > 1) {
                    const itemDatas = items.map(v => v.data())
                    mergedMenus.push({
                        name: newMenuName,
                        submenu(sub) {
                            for (const menu of itemDatas) {
                                sub.append_menu(menu)
                            }
                        },
                    })
                    for (const menu of items) {
                        menu.remove()
                    }
                }
            }

            if (read_config_key('merge.open_with')) {
                mergeMenuItems(ctx.menu.get_items().filter(menu => {
                    const data = menu.data()
                    const blacklist = [
                        '在新窗口中打开', '在新标签页中打开', '打开', '打开方式'
                    ]
                    if (blacklist.includes(data.name)) return false
                    const whitelist = [
                        // common matches
                        '打开', 'open', '使用', '播放列表', '播放队列', '编辑',
                        // specific softwares
                        'ida pro'
                    ]
                    const fullmatch = ['WizTree']
                    return whitelist.some(name => data.name?.toLowerCase().includes(name)) ||
                        fullmatch.some(name => data.name === name)
                }), '打开方式')
            }

            if (read_config_key('merge.view_operation')) {
                mergeMenuItems(ctx.menu.get_items().filter(menu => {
                    const data = menu.data()
                    const fullmatch = ['查看', '排序方式', '分组依据']
                    return fullmatch.some(name => name === data.name)
                }), '视图操作')
            }

            if (read_config_key('merge.uncommon')) {
                mergeMenuItems(ctx.menu.get_items().filter(menu => {
                    const data = menu.data()
                    const fullmatch = ['自定义文件夹...', '授予访问权限', '还原以前的版本', '包含到库中', '固定到“开始”', '添加到收藏夹', '共享']
                    const whitelist = ['发送']
                    return fullmatch.some(name => name === data.name) || whitelist.some(name => data.name?.includes(name))
                }), '不常用')
            }

            // merge duplicate spacer
            const items = ctx.menu.get_items()
            let is_last_spacer = false
            for (const item of items) {
                if (item.data().type === 'spacer') {
                    if (is_last_spacer) {
                        item.remove()
                    }
                    is_last_spacer = true
                } else

                    is_last_spacer = false
            }

            // adjust position
            if (mergedMenus.length) {
                for (const menu of ctx.menu.get_items()) {
                    const dupname = mergedMenus.find(v => v.name === menu.data().name)
                    if (dupname) {
                        const orig_submenu = menu.data().submenu
                        menu.set_data({
                            submenu(sub) {
                                orig_submenu?.(sub)
                                sub.append_menu({
                                    type: 'spacer'
                                })
                                dupname.submenu(sub)
                            }
                        })

                        mergedMenus.splice(mergedMenus.indexOf(dupname), 1)
                    }
                }
                const target = ctx.menu.get_items().findIndex(v => v.data().type == 'spacer')
                for (const menu of mergedMenus) {
                    ctx.menu.append_menu_after(menu, target)
                }
                ctx.menu.append_menu_after({
                    type: 'spacer'
                }, target)
            }

        } catch (e) {
            shell.println(e, e.stack)
        }
    })
}, 100)
