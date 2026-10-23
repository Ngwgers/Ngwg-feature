# Ngwg-feature

内置插件，为主题提供实用工具。

## 接口

> 下文中的用途由 AI 总结

| helper | 用途 |
| --- | --- |
| `formatDate(date, fmt)` | 日期格式化（`YYYY MM DD HH mm ss`） |
| `archives(posts)` | 按年分组的归档结构 |
| `tagCloud(tags)` / `categoryTree(cats)` | 带计数的标签/分类列表（按数量排序） |
| `excerpt(post, len)` | 纯文本摘要（剥标签、截断；优先取 `<!-- more -->` 标出的前言） |
| `wordCount(post)` | 字数（CJK 按字、拉丁按词，剥代码与链接目标；读原始 `body`，长文分段后仍统计全篇） |
| `readingTime(post)` | 预计阅读分钟数（CJK 400 字/分、拉丁 220 词/分，最少 1） |
| `limit(arr, n)` | 取前 N 项 |
| `slugify(s)` | URL 安全 slug（与 Core 生成的目录名一致） |
| `postsWithTag(site, tag)` / `postsInCategory(site, cat)` | 按标签/分类取文章 |
| `t(key, args…)` | i18n 翻译：`{{@ t "archive.subtitle" site.posts.length }}`，`{0}` 被参数替换（需 i18n 主题，见 Ngwg-docs/theme-development.md） |

示例调用：`{{@ formatDate page.meta.date "YYYY-MM-DD" }}`。

## copy_files

构建完成后，将工作目录（运行 `ngwg` 的目录）下声明的文件或目录原样复制到产出目录（`public/`），相对路径保持不变。符号链接会被跟随（文件按内容复制、目录递归复制），循环链接会跳过。

```yaml
plugins:
  feature:
    option:
      copy_files:
        - CNAME
        - static          # → public/static/**
        - assets/logo.png # → public/assets/logo.png
```

缺失的条目或断开的符号链接只会产生警告，不会中断构建；指向工作目录之外或产出目录本身的条目会被跳过。

## 许可证 / License

本项目基于 [GNU General Public License v3.0 (GPL-3.0)](LICENSE) 发布。
This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).

