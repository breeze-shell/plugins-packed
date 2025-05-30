// @name: MenuInspector
// @description: (开发工具) 显示当前右键菜单相关信息
// @version: 0.0.2
// @author: MicroBlock

import * as shell from "mshell"

shell.menu_controller.add_menu_listener(ctx => {
    ctx.menu.append_menu({
        name: '菜单数据',
        submenu(sub) {
            const text = (menu, text, submenu, icon) => {
                return menu.append_menu({
                    name: text,
                    submenu, icon_svg: icon,
                    action() {
                        shell.clipboard.set_text(text)
                        ctx.menu.close()
                    }
                })
            }

            const button = (menu, text, action, icon) => {
                return menu.append_menu({
                    name: text,
                    action, icon_svg: icon
                })
            }

            if (ctx.context.folder_view) {
                text(sub, '文件夹视图', sub => {
                    text(sub, '当前路径', sub => {
                        text(sub, ctx.context.folder_view.current_path, null, null)
                    })
                    text(sub, '选中文件', sub => {
                        ctx.context.folder_view.selected_files.forEach(v => {
                            text(sub, v, null, null)
                        })
                    })
                })
            }

            if (ctx.context.window_info) {
                text(sub, '窗口信息', sub => {
                    text(sub, 'exe', sub => {
                        text(sub, ctx.context.window_info.executable_path, null, null)
                    })
                    text(sub, '位置', sub => {
                        text(sub, `${ctx.context.window_info.x}, ${ctx.context.window_info.y}`, null, null)
                    })
                    text(sub, '大小', sub => {
                        text(sub, `${ctx.context.window_info.width}, ${ctx.context.window_info.height}`, null, null)
                    })
                    text(sub, 'Props', sub => {
                        if (ctx.context.window_info.props.size === 0) {
                            text(sub, '无', null, null)
                        }
                        for (const {key, value} of ctx.context.window_info.props) {
                            text(sub, `${key}: ${value}`, null, null)
                        }
                    })
                })
            }

            sub.append_menu({
                type: 'spacer'
            })

            for (const menu of ctx.menu.get_items()) {
                const data = menu.data()
                // if (!data.name) continue;
                text(sub, data.name, sub => {
                    for (const key in data) {
                        let data_k = data[key]
                        if (!data_k) continue;
                        if (typeof data_k === 'function') {
                            data_k = 'function'
                        }

                        if (typeof data_k === 'object') {
                            data_k = JSON.stringify(data_k)
                        }

                        sub.append_menu({
                            name: key,
                            action() {
                                shell.clipboard.set_text(data_k)
                                ctx.menu.close()
                            },
                            submenu(sub) {
                                const preview_text = (text) => {
                                    if (text.length > 50) {
                                        return text.substring(0, 50) + '...'
                                    }
                                    return text
                                }

                                button(sub, preview_text(data_k), () => {
                                    shell.clipboard.set_text(data_k)
                                    ctx.menu.close()
                                }, null)
                            }
                        })
                    }
                })
            }
        }
    })
})
