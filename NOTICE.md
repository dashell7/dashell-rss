# Dashell RSS source and license notices

This is a local development candidate, not an official RSS Dashboard or
Qiaomu AI RSS release. The combined derivative is GPL-3.0-only; see LICENSE.

## RSS Dashboard

- Source: https://github.com/amatya-aditya/obsidian-rss-dashboard
- Base: dev, c82ad940eb82e47695568cba3ea75d57b623ecfc
- Selected update: 2.7.1, 4cc2daf72c41229074309e9d1da2a84dffb38cf7
  (Feed Manager light-theme button contrast only; the dev branch was not merged).
- Copyright (c) [2025] [Aditya Amatya]
- Original license: MIT, preserved in licenses/RSS-Dashboard-MIT.txt.
- Changes: Dashell branding, learning metadata, local-material imports,
  learning sessions and Reader/Player integration in the existing plugin.
  Original subscriptions, read status, favorites and storage remain owned
  by RSS Dashboard's existing services.

## Qiaomu AI RSS

- Source: https://github.com/joeseesun/qiaomu-ai-rss
- Reference: ac2c792bfebe4604bc30d2e3ae3af6387c918c2b
- Copyright (c) 向阳乔木
- License: GPL-3.0-only, preserved in LICENSE.
- Adapted sources: src/content.ts (safe HTML/Markdown rendering),
  src/view.ts (reading toolbar/version selector) and styles.css (reading
  layout/prose). Local files: src/dashell/content.ts,
  src/dashell/reader-chrome.ts, src/dashell/learning-panel.ts and
  src/styles/dashell-reader.css.
- Changes: FeedItem and Dashell material adapters; native RSS Dashboard
  navigation/state/actions; only available source versions are offered;
  existing reader-format settings and host/Velocity theme variables apply.
- Qiaomu's proprietary content service, accounts and curated feeds are not
  bundled or implied by this adaptation. Source-provided translation and
  rewrite variants are not an on-demand AI service.

## Added bundled libraries

- DOMPurify 3.4.16: Apache-2.0 selected from its dual license
  (MPL-2.0 OR Apache-2.0). See licenses/DOMPurify-Apache-2.0.txt.
- marked 18.0.14: MIT. See licenses/marked-MIT.txt.

The existing RSS Dashboard dependencies retain their original licenses and
bundle notices. Source snapshots, tests and build instructions must accompany
any future GPL binary distribution. This working tree has not been published.
