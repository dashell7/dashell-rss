# Dashell adaptation of Qiaomu AI RSS 0.32.1

## Source and scope

Checked on 2026-10-24 against the actual Dashell default branch
`codex/dashell-rss-upstream-sync` at `e16349a770d69f60890a4d19de00f61fdd70882c`.
The latest formal upstream release is
[0.32.1](https://github.com/joeseesun/qiaomu-ai-rss/releases/tag/0.32.1),
tag commit `22f5509446df4f2f80d896a78c8763d4137b52f1`.
[0.31.0 to 0.32.1](https://github.com/joeseesun/qiaomu-ai-rss/compare/0.31.0...0.32.1)
also includes the formal 0.32.0 local-deletion feature and dependency updates.
Only released tags were evaluated; unreleased main is not an update source.

The image tokenizer in `src/dashell/content.ts` adapts upstream commit
`22f5509`, preserving GPL-3.0-only attribution. An isolated `Marked` instance
recognizes a standalone HTTP(S) image whose alt label has an unmatched opening
bracket, such as `![[image](https://example.com/image.png)`. Balanced/escaped
brackets, inline Markdown, fenced and inline code, and Obsidian embeds retain
their standard parser behavior. HTTP(S) URLs containing parentheses and
encoded Substack image paths are covered. Recovered attributes are escaped,
then pass through the existing DOMPurify allowlist and URL validation.

This changes the rewrite conversion boundary used by Dashell's preview and
learning exporter. Existing translated/rewrite previews still use
`images=false`: repaired image tokens disappear without leftover broken
labels or image requests. Learning export uses `images=true`, unwraps lookup
links as before, and writes ordinary Markdown image embeds that the existing
Dashell Reader can render. Original/translation HTML and cached source strings
are not rewritten; original, translation and rewrite files retain their shared
Reader manifest. No migration is needed.

There are no new runtime dependencies, settings, storage, player, timers,
global parser modifications or main importers. `main.ts`, architecture
baselines and lint suppressions are unchanged. The package and manifest
remain **2.7.3**; this merge does not publish a Release.

## Deferred 0.32.0 local deletion

Upstream's reversible deletion adds a persistent source-scoped tombstone
matcher, its own serialized edit/rollback workflow, list and reader guards,
and a restore manager. Dashell retains independently persisted feed body
shards, `${feedId}:${guid}` user state with hydration-gated garbage collection,
saved Reader notes and learning records. Removing a visible row alone would
not prevent refreshed articles from returning, and copying the upstream store
would introduce a second identity/persistence system.

Persistent deletion is therefore deferred until its identity, restoration,
garbage-collection and synchronization contract is designed for these stores.
No entries or saved files are deleted by the adaptation. This is an explicit
scope decision, not an unfinished failed port to retry every day. The upstream
DOMPurify patch is already present as 3.4.17 from the previous sync; broad
development dependency churn is not copied.

## Development dependency audit

The local all-dependency high-severity gate identified undici 7.30.0 under
jsdom, including
[GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c).
Only its development lock entry advances to the maintainer's patched
[7.30.1](https://github.com/nodejs/undici/releases/tag/v7.30.1), within jsdom's
existing range; no package declaration or production package changes.
Production audit reports zero vulnerabilities. The all-dependency high gate
passes with seven moderate development-toolchain findings remaining; this is
not a claim of zero findings across all dependencies.

## Verification

- Tests first reproduced six failures in the untouched converter/exporter.
  Focused tests pass after the fix, including image-disabled behavior,
  bracket escaping, unsafe schemes, sanitizer protection, code preservation,
  isolated parser state, and an export roundtrip through ordinary Markdown.
- Full suite after the undici patch: **337 files / 5,273 tests passed**;
  coverage gates passed: statements **74.90%**, branches **66.28%**,
  functions **73.47%**, lines **76.08%**.
- Full build passed: source ESLint with zero warnings, production/test types,
  architecture, platform, CSS, release metadata and documentation checks.
- Actual Windows Obsidian, window title **1.14.4**, in the designated existing
  `F:/qiaomu-reader-english`: installed candidate assets matched the tested
  build. Real RSS preview DOM operations verified rewrite/translation/original
  switching, original node identity, refreshed outline, preserved code, and
  hidden preview images issuing no image requests.
- The actual Importer saved three version files with metadata and lookup-link
  unwrapping. Opening the rewritten file in the actual Dashell Reader and
  navigating to its image section decoded all four controlled loopback PNGs,
  including the three malformed source images and a balanced ordinary one.
  The fenced-code section remained code. Reloading RSS retained the saved
  source, metadata and three files. Key ordering is not treated as a data
  difference by the host fixture.

The first Reader assertion inspected its title section rather than the image
section; navigating via the actual TOC corrected the fixture without production
changes. Clearing the QA Reader leaf emitted six ResizeObserver notifications;
the restored original VideoCaptioner RSS assets reproduced the same type of
notification (four) while closing equivalent ordinary-image QA pages. These
are retained in host diagnostics, not reported as a clean error log or attributed
to the new parser. The final restored idle observation captured no new errors.

QA files, the Reader-generated companion note and local HTTP server were
removed/stopped. Original layout and both plugins were restored: all **13 RSS
files**, **9 Reader files**, and the **one pre-existing Markdown note** matched
their fresh backups byte for byte, with no extra plugin files. The installed
RSS therefore remains the original unpublished VideoCaptioner candidate; its
dirty source checkout was untouched. RSS builds include commit/time metadata,
so different builds are not claimed to be byte-identical.

This verifies controlled content and loopback transport in that Windows desktop
session. It does not verify external feed/CDN availability, macOS, physical
mobile devices, cold start, sync, external accounts or new speech synthesis.
Reader upstream remains 4.7.9, Dashell main `68e8828`, formal Release 4.4.7,
with no changes in this run. Evidence and backups are in the task's
`dashell-upstream-20261024` temporary directory.
