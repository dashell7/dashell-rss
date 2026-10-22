# Qiaomu AI RSS 0.30.2 adaptation

Checked on 2026-10-22. Dashell base: `89471bf8a91239df2dce52b41920452230ac6b6f`,
actual default branch `codex/dashell-rss-upstream-sync`. Package and manifest
remain **2.7.3**; this is an unreleased source update.

## Evidence and scope

- [Formal 0.30.2 release](https://github.com/joeseesun/qiaomu-ai-rss/releases/tag/0.30.2),
  tag commit `a5ce40bcc9ed63fe18d761c18297026be7c74432`.
- [0.30.0 to 0.30.2](https://github.com/joeseesun/qiaomu-ai-rss/compare/0.30.0...0.30.2).
- Adapt the 0.30.1 original-article link fix from upstream `d42212e` into
  `src/utils/wechat-article-links.ts` under GPL-3.0-only, retaining copyright.
- Do not copy 0.30.2's six Qiaomu-channel Chinese podcast entries. They depend
  on the separate curated service/catalogue that Dashell does not own. Existing
  user podcast subscriptions, native media previews and Player handoff remain.

## Resulting behavior

The display/export copy unwraps only HTTPS links at the exact
`wechat2rss.bestblogs.dev` origin and `/link-proxy` path, with or without a
trailing slash. The decoded `u` must be an uncredentialed HTTPS article at the
exact `mp.weixin.qq.com` origin, using `/s` or a short `/s/<id>` path. The
article query and fragment are retained; outer proxy parameters are discarded.
Only the exact generic labels “跳转微信打开” and “跳转到微信打开” become
“查看公众号原文”; custom labels and their inline markup are preserved.

The helper runs after sanitization in ordinary and learning previews, and in
the existing ArticleSaver and preview-save Markdown paths. Cached feed HTML is
not rewritten or migrated. Learning exports still unwrap body anchors into
text for Reader lookup, while retaining the clearer label and source metadata.

Dashell's existing Substack image recovery also visits anchors. Its broad
encoded-URL fallback could previously decode a URL inside another site's query
before the WeChat validator saw the proxy origin, appending outer parameters.
Limit that fallback to encoded trailing paths, leaving query/fragment URLs
alone; existing Substack image-path recovery continues to pass its tests.

No main imports, second cache, transport, speech player, settings or dependencies
are introduced. Existing module ownership and storage remain unchanged.

## Verification and limits

- Before the fix, the new regression suite failed 7 of 10 cases on the old
  code. Final full suite: **334 files passed, 5249 tests passed**.
- Regression tests cover strict/rich/learning previews, original and short
  article URLs, intact query/fragment, generic/custom labels, malformed and
  unsafe targets, lookalike origins, ordinary HTML saves, full-content Markdown
  saves, preview Markdown exports and unmodified cached content. Existing
  Substack and reader tests remain green.
- Complete build passes: architecture, platform, CSS/document/release gates,
  ESLint with zero warnings, production/test types and production bundles.
- Actual Windows Obsidian window version 1.14.4, designated existing vault:
  cached fixture preview shows the direct link and clearer label, leaves a
  lookalike proxy unchanged, switches translated/original learning previews,
  writes ordinary HTML and preview Markdown through the production saver and
  verifies their contents on disk. Learning export keeps its anchor-unwrapping
  rule. The source fixture stays unchanged; no uncaught errors were captured.
- QA records are clearly named and deleted afterward. Existing plugin data,
  original layout and the one original Markdown note are restored/verified.
  The host's pre-existing unpublished VideoCaptioner assets are restored
  exactly; its separate dirty source checkout is untouched. GitHub receives
  this adaptation, not the VideoCaptioner candidate.

This uses controlled HTML and actual vault writes, without navigating to
WeChat. It does not establish external WeChat availability, mobile/macOS
behavior, cold startup or synchronization. Local evidence is retained in the
task's `dashell-upstream-20261022` temporary evidence directory.
