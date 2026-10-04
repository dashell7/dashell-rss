export const SETTINGS_TEXT_EXTRA: Record<string, string> = {
  Dashboard: "面板",
  "Pagination position": "分页位置",
  Justify: "两端对齐",
  Left: "左对齐",
  Sans: "无衬线字体",
  "Adjust the spacing between cards in dashboard card view":
    "调整面板卡片视图中卡片之间的间距",
  "Set card columns in dashboard card view (0 = auto)":
    "设置面板卡片视图的列数（0 表示自动）",
  "This removes only cached dashboard preview images. Feed data, settings, and saved articles are unchanged.":
    "此操作只会清除面板预览图片缓存，不会更改订阅源数据、设置或已保存的文章。",
  "Default playback speed for podcast episodes": "播客节目的默认播放速度",
  "Default Mastodon folder": "默认 Mastodon 文件夹",
  "Default folder for Mastodon feeds": "Mastodon 订阅源的默认文件夹",
  "Default YouTube folder": "默认 YouTube 文件夹",
  "Default folder for YouTube feeds": "YouTube 订阅源的默认文件夹",
  "Default podcast folder": "默认播客文件夹",
  "Default folder for podcast feeds": "播客订阅源的默认文件夹",
  "Default RSS folder": "默认 RSS 文件夹",
  "Default folder for RSS feeds": "RSS 订阅源的默认文件夹",
  "Default smallweb folder": "默认 Smallweb 文件夹",
  "Default folder for smallweb feeds": "Smallweb 订阅源的默认文件夹",
  "Choose where to apply highlights:": "选择高亮的应用位置：",
  "Words and phrases to highlight in articles:": "要在文章中高亮的单词和短语：",
  "Apply highlights to article titles in the list/card view":
    "在列表或卡片视图的文章标题中应用高亮",
  "Apply highlights to article summaries in card view":
    "在卡片视图的文章摘要中应用高亮",
  "Apply highlights to article content in reader view":
    "在阅读器中的文章正文应用高亮",
  "Reset to default": "恢复默认",
  "Support development": "支持开发",
  "Report issue": "反馈问题",
  "Content can be saved directly to your vault.":
    "内容可以直接保存到你的保险库。",
  "RSS dashboard is a free, open-source community plugin for Obsidian that makes it easy to manage your RSS feeds, YouTube subscriptions, and podcasts in one place.":
    "RSS Dashboard 是一款免费的 Obsidian 开源社区插件，方便你在一个位置管理 RSS 订阅、YouTube 订阅和播客。",
  "RSS Dashboard was originally created by": "RSS Dashboard 最初由 ",
  ", with active development and support offered by":
    " 创建，自 2.2.0 版本起由 ",
  "since version 2.2.0, alongside many contributions from the community.":
    "持续开发和维护，并由社区贡献者共同完善。",
  "Factory reset?": "恢复出厂设置？",
  "Existing backup files and saved article markdown files in your vault will not be deleted.":
    "不会删除保险库中的现有备份文件和已保存文章 Markdown 文件。",
  "This restores all plugin settings to their default values and clears your feeds, folders, tags, and plugin-managed local state.":
    "此操作会将插件设置恢复为默认值，并清除订阅源、文件夹、标签和插件管理的本地状态。",
  "This plugin uses the YouTube IFrame API for video playback. By using this feature, you agree to be bound by the":
    "此插件使用 YouTube IFrame API 播放视频。使用此功能即表示你同意遵守",
  AND: "且",
  OR: "或",
  "Add new rule...": "添加新规则...",
  "Not yet run": "尚未运行",
  "What's new": "更新内容",
  "Create global include/exclude keyword rules. Rules are case-insensitive, and per-feed settings can optionally override these global rules.":
    "创建全局关键词包含/排除规则。规则不区分大小写，也可在单个订阅源设置中覆盖全局规则。",
  "Legacy JSON:": "旧版 JSON：",
  "large monolith file. does not sync across devices (often exceeds 5mb limit)":
    "大型单体文件。无法在设备间同步（通常超过 5 MB 限制）",
  "Shard storage v1:": "分片存储 v1：",
  "Creates individual vault files for each feed to improve syncing, but stores state (read, starred) inside the feed file, which can still cause minor sync conflicts.":
    "为每个订阅源创建独立的保险库文件以便同步，但已读和星标状态仍保存在订阅源文件中，因此仍可能出现轻微的同步冲突。",
  "Shard storage v2:": "分片存储 v2：",
  "Splits feed content and user state (read, starred, tags) into separate files, providing the most robust sync experience.":
    "将订阅源内容与用户状态（已读、星标、标签）拆分到不同文件中，提供更可靠的同步体验。",
  "Left padding": "左侧内边距",
  "Right padding": "右侧内边距",
  "Adjust left padding for sidebar rows": "调整侧边栏行的左侧内边距",
  "Adjust right padding for sidebar rows": "调整侧边栏行的右侧内边距",
  "Sidebar row spacing": "侧边栏行间距",
  "Adjust the height between rows in the sidebar feed list":
    "调整侧边栏订阅源列表中各行之间的高度",
  "Sidebar row indentation": "侧边栏行缩进",
  "Adjust the indentation of nested items in the sidebar":
    "调整侧边栏中嵌套项目的缩进",
  "Use site icons/favicons for RSS feeds": "RSS 订阅源使用网站图标",
  "Replace the standard RSS feed icon with the site icon/favicon when one is available":
    "有网站图标时，用它替换默认 RSS 图标",
  "Use album/show artwork for Podcast feeds": "播客订阅源使用专辑或节目封面",
  "Replace the standard podcast mic icon with the album/show artwork when one is available":
    "有专辑或节目封面时，用它替换默认播客图标",
  "Use profile images for Mastodon feeds": "Mastodon 订阅源使用个人资料图片",
  "Replace the standard Mastodon feed icon with the feed profile image when one is available":
    "有个人资料图片时，用它替换默认 Mastodon 图标",
  And: "并且",
  Or: "或者",
  "No tags available": "没有可用标签",
  Saved: "已保存",
  Podcast: "播客",
  Videos: "视频",
  Video: "视频",
  Tagged: "有标签",
  Untagged: "无标签",
  Discover: "发现",
  Divider: "分隔线",
  "Add Feed": "添加订阅源",
  "Manage Feeds": "管理订阅源",
  Search: "搜索",
  "Add Folder": "添加文件夹",
  Sort: "排序",
  "Collapse All": "全部折叠",
  Settings: "设置",
  "Clear RSS site icons?": "清除 RSS 网站图标？",
  "Clear Podcast artwork?": "清除播客封面？",
  "Clear Mastodon profile images?": "清除 Mastodon 个人资料图片？",
  "Clear site icons": "清除网站图标",
  "Clear artwork": "清除封面",
  "Clear profile images": "清除个人资料图片",
  "A user-state.json from a previous shard storage v2 setup is still at ${leftoverPath}. It is not read in the current storage mode, and is kept as a backup of read, starred, tagged, and saved state. Delete it manually once you no longer need it.":
    "旧版分片存储 v2 的 user-state.json 仍位于 ${leftoverPath}。当前存储模式不会读取此文件，它作为已读、星标、标签和已保存状态的备份保留。不再需要时可手动删除。",
  "This word is already in the list": "此单词已在列表中",
  "Please enter a word to highlight": "请输入要高亮的单词",
  "Previous metadata files deleted.": "旧 metadata 文件已删除。",
  "Vault storage migration completed.": "保险库存储迁移已完成。",
  "Vault storage v2 migration completed.": "保险库存储 v2 迁移已完成。",
  "Proxy URL saved": "代理 URL 已保存",
  "Max item limit applied to all feeds. Refresh all feeds to fetch additional items.":
    "文章数量上限已应用到所有订阅源。刷新所有订阅源以获取更多文章。",
};
