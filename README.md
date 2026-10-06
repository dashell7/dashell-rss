# Dashell RSS

Maintained by [dashell](https://github.com/dashell7). [Source](https://github.com/dashell7/dashell-rss) · [Issues](https://github.com/dashell7/dashell-rss/issues) · [Latest release 2.7.3](https://github.com/dashell7/dashell-rss/releases/latest).

Dashell RSS handles feed subscriptions, previews, and local saving of learning materials. [Dashell Reader](https://github.com/dashell7/dashell-reader) is for text reading and dictionary lookup; [Dashell Player](https://github.com/dashell7/dashell-player) is for audio, video, subtitles, and dictation. Install them separately or combine them for a local English-learning workflow.

This repository is a customization of RSS Dashboard. The original project documentation follows the Dashell-specific instructions below; source and license notices are preserved in [NOTICE.md](NOTICE.md).

## Install Dashell RSS

The current release is **2.7.3**. Dashell RSS is distributed from [GitHub Releases](https://github.com/dashell7/dashell-rss/releases) and is not the upstream RSS Dashboard Community Plugins listing.

### BRAT

1. Install and enable **BRAT** from Obsidian Community Plugins.
2. In BRAT, choose **Add beta plugin** and enter `dashell7/dashell-rss`.
3. Install and enable **Dashell RSS** in Community plugins.

### Manual install

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/dashell7/dashell-rss/releases/latest), then copy them into `<vault>/.obsidian/plugins/dashell-rss/` using your vault's actual configuration folder. Disable the upstream `rss-dashboard` plugin before enabling Dashell RSS.

The plugin ID is `dashell-rss`. On first launch, it copies settings, feed shards, article state, learning records, and backups from an earlier `dshell-rss` or `rss-dashboard` folder. Source files remain for rollback, and custom vault storage folders stay unchanged. Existing Dashell RSS installations update in place.

## Dashell RSS features

Dashell RSS keeps the RSS Dashboard subscription workflow and connects saved
articles to the local English-learning workflow:

- Subscribe to RSS, Atom and JSON feeds, podcasts, and YouTube channels; organize and filter feeds in the dashboard.
- Preview articles in the built-in reader, and keep the existing RSS preview for podcasts and videos.
- Save articles as Markdown for Dashell Reader, with normalized filenames and ordinary text in linked passages so hover and click lookup can work.
- Preserve supplied original, translated, and rewritten article versions; Dashell Reader remembers reading progress separately for each version.
- Keep reading appearance, dictionary lookup, AI, and review-card settings in Dashell Reader; RSS handles feed discovery, previews, and local saving.

The following README content describes the upstream RSS Dashboard features retained by this customization. Original source and license notices are in [NOTICE.md](NOTICE.md).

<div align="center">
  <img src="assets/branding/logo.png" alt="RSS Dashboard Logo" width="180" />
</div>

## Upstream RSS Dashboard features

Only the feeds you need. Stream the world's knowledge into your vault: RSS, podcasts, YouTube, and more, all in one dashboard.

[![Latest release](https://img.shields.io/github/v/release/amatya-aditya/obsidian-rss-dashboard?style=flat-square&color=573E7A&label=release)](https://github.com/amatya-aditya/obsidian-rss-dashboard/releases/latest)
[![License](https://img.shields.io/github/license/amatya-aditya/obsidian-rss-dashboard)](https://github.com/amatya-aditya/obsidian-rss-dashboard/blob/main/LICENSE)
![Total downloads](https://img.shields.io/github/downloads/amatya-aditya/obsidian-rss-dashboard/total)

**[Install](#installation)** · **[Documentation](docs/)** · **[Discord](https://discord.gg/9bu7V9BBbs)** · **[Latest Release](https://github.com/amatya-aditya/obsidian-rss-dashboard/releases/latest)** · **[Contributing](CONTRIBUTING.md)**

![RSS Dashboard reader view](assets/2.2/2.2_Dashboard_reader.jpg)

## What is RSS Dashboard?

A free, open-source Obsidian plugin that streams RSS, podcasts, YouTube, and more directly into your vault. Read, organize, and save content without leaving Obsidian.

**No ads. No trackers. No pop-ups. Open source.**

## Community & Philosophy

Built for people who value privacy and data ownership. Part of the Obsidian ecosystem—developed in the open, funded by the community, and designed to integrate seamlessly with your vault.

Want to help shape the next release? [Join Discord](https://discord.gg/9bu7V9BBbs)

## Read Without Distraction

Full article content fetched and rendered right in Obsidian. No ads, no distracting sidebars—just the text you came to read. Track your progress through articles, videos, and podcasts. Resume where you left off, distraction-free.

## Build Your Reading System

Your feeds, organized your way. Create folders and subfolders, add custom tags, filter by read status or feed, sort by date or category. Automatic refresh keeps your subscriptions current. Discover new feeds from our curated Discover page or browse smaller independent blogs through Kagi Smallweb.

![RSS Dashboard dashboard and organization](assets/2.2/2.2_Dashboard.jpg)

## Keep What Matters

Save articles directly to your vault as Markdown. Customize what gets saved with templates, frontmatter variables, and automatic tagging. Your archive, perfectly formatted.

## Own Your Data

Completely local. Completely open source. No ads, no tracking, no paywalls—just your data, stored on your device. Full control over what you read and how it's organized.

## Move Your Data Freely

Import and export your subscriptions as OPML. Support for RSS, Atom, JSON feeds, YouTube channels, podcasts, and Mastodon accounts. Migrating from Inoreader or FreshRSS? [Import your starred articles](docs/user/starred-import-guide.md) directly. Switch tools anytime—your data comes with you.

## Screenshots

> [!NOTE]
> These screenshots predate 2.7.0. The **Twitter** folder and the X/Twitter feeds in the sidebar relied on the Nitter integration, which was removed in 2.7.0 after Nitter shut down. See the [changelog](CHANGELOG.md) for details and alternatives.

![RSS Dashboard Discover page](assets/2.2/2.2_Discover.jpg)

## Version 2.2.0 Demo

Version 2.2.0 demo (core experience remains similar).

[![What's New in 2.2.0?](assets/2.2/video_thumbnail/2.2_Dashboard_video_thumbnail_youtube_icon.png)](https://www.youtube.com/watch?v=Lq2TRCZlqlQ)

## Install the upstream RSS Dashboard

The following Community Plugins steps install the original **RSS Dashboard**, not Dashell RSS. Use the Dashell installation instructions above to install this customization.

1. Open **Settings** in Obsidian.
2. Go to **Community plugins** → disable **Restricted mode** (if enabled).
3. Click **Browse**.
4. Search **RSS Dashboard** and click **Install**.
5. Enable the plugin in Community plugins list.

For BRAT beta testing or manual installation, see [Installation Methods](docs/user/installation.md).

## Getting Started

1. Open RSS Dashboard from the ribbon or command palette.
2. Click **+** to add your first feed. Try a familiar URL (e.g., a news site or YouTube channel).
3. Click an article to read in the built-in reader.
4. Optionally save articles to your vault.

For detailed workflows, see [Getting Started Guide](docs/user/getting-started.md).

## Documentation

Complete guides, workflows, and reference: [Read the Docs](docs/)

## Roadmap

Feature direction and what's being explored: [Public Roadmap](docs/plans/public-roadmap.md)

## Support & Community

- 💬 [Discord Community](https://discord.gg/9bu7V9BBbs)
- 🐛 [GitHub Issues](https://github.com/amatya-aditya/obsidian-rss-dashboard/issues)
- ❓ [Troubleshooting](docs/user/troubleshooting.md)

## Contributing

Want to help? [See CONTRIBUTING.md](CONTRIBUTING.md)

## Support Development

If you find this plugin useful:

- [Buy me a coffee](https://www.buymeacoffee.com/amatya_aditya)
- [Ko-fi](https://ko-fi.com/Y8Y41FV4WI)

## License

MIT. See [LICENSE](LICENSE) for details.
