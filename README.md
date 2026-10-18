# Ngwg-feature

内置插件，为主题提供实用工具。

## 接口

> 下文中的用途由 AI 总结

| helper | 用途 |
| --- | --- |
| `formatDate(date, fmt)` | 日期格式化（`YYYY MM DD HH mm ss`） |
| `archives(posts)` | 按年分组的归档结构 |
| `tagCloud(tags)` / `categoryTree(cats)` | 带计数的标签/分类列表（按数量排序） |
| `excerpt(post, len)` | 纯文本摘要（剥标签、截断） |
| `limit(arr, n)` | 取前 N 项 |
| `slugify(s)` | URL 安全 slug（与 Core 生成的目录名一致） |
| `postsWithTag(site, tag)` / `postsInCategory(site, cat)` | 按标签/分类取文章 |
| `t(key, args…)` | i18n 翻译：`{{@ t "archive.subtitle" site.posts.length }}`，`{0}` 被参数替换（需 i18n 主题，见 Ngwg-docs/theme-development.md） |

示例调用：`{{@ formatDate page.meta.date "YYYY-MM-DD" }}`。

## 许可证 / License

本项目基于 [GNU General Public License v3.0 (GPL-3.0)](LICENSE) 发布。
This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).

