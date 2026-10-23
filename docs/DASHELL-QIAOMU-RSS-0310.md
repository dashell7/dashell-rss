# Qiaomu AI RSS 0.31.0 adaptation

Checked on 2026-10-23. Dashell base: `30fa399cfe83b475829a93b37b76c199fa214bd1`,
actual default branch `codex/dashell-rss-upstream-sync`. Package, manifest and
latest formal release remain **2.7.3**; this is an unreleased source update.

## Evidence and scope

- [Formal 0.31.0 release](https://github.com/joeseesun/qiaomu-ai-rss/releases/tag/0.31.0),
  tag commit `402abedaf3cd29cb8fea32d513a94a468527b381`.
- [0.30.2 to 0.31.0](https://github.com/joeseesun/qiaomu-ai-rss/compare/0.30.2...0.31.0)
  contains the outline/reading-controls commit `681d78ac67d4c0d15a581c0e837095f904e4c48e`
  and release metadata.
- `src/utils/article-outline.ts` and `src/components/reader-outline.ts` adapt
  the upstream heading hierarchy, cached geometry and binary-search tracking
  under GPL-3.0-only, retaining source attribution.

## Resulting behavior

Each article preview owns its outline panel in the existing reading toolbar.
Standalone previews and the Dashboard reading workbench expose the same
heading navigation. Repeated titles remain distinct by their DOM element;
skipped heading levels get compact indentation. Empty, hidden and collapsed
headings are omitted. An article without headings has an explicit empty state.

Choosing a heading scrolls that article and cancels pending workbench scroll
restoration. Ordinary scrolling follows the current section, reusing measured
positions until a resize or image load changes layout. Opening the outline
does not rewrite the article, insert heading IDs, change the selection, or
mutate its stored source. Existing translated HTML and rewritten Markdown
already retain headings; switching versions refreshes the panel, and returning
to original retains the exact original nodes. No content migration is needed.

The panel uses existing theme variables, keyboard focus styles, native details
semantics and an accessible control name. Escape returns focus to its control;
outside clicks close it. Observers and queued frames are released on close,
article replacement and disposal. Document listeners and trackers follow an
actual Obsidian popout migration and release the old window. Reading settings
have a direct workbench toolbar action, using the existing settings portal.

The upstream global sidebar view/registration and translation-pair format are
not copied into Dashell's separate preview/learning architecture. No new
settings store, data migration, dependency, media player or speech service is
introduced. Existing Reader/Player handoff and media previews keep their
current lifecycle. `main.ts`, architecture baselines and lint suppressions are
unchanged; no new main importer or runtime cycle is introduced.

## Validation

- Full unit suite: **336 files / 5,258 tests passed**, including duplicate
  headings, hierarchy, geometry caching, active section, pending restoration,
  version updates, original-node identity, keyboard/outside close, toolbar
  refresh, disposal and owning-window migration.
- Coverage gates passed: statements **74.89%**, branches **66.26%**, functions
  **73.47%**, lines **76.07%**.
- `npm run build` passed: source ESLint with zero warnings, main/test types,
  architecture, platform, CSS scope/important, commit, release and doc checks.
- Windows Obsidian (window title **1.14.4**) in the designated existing F: test
  vault: actual standalone/workbench previews, selected duplicate jump,
  active section, original/translated/rewritten updates, original DOM/selection
  retention, empty state, direct reading settings, toolbar refresh, article
  switch and close passed. Actual 360px and desktop widths in light/dark themes
  showed visible panels without overflow; screenshots were visually checked.
- Actual native popout migration passed: same open panel, old-document clicks
  ignored, new-document outside close, jump/current section, Escape focus and
  disposal; no captured errors during these controlled operations.

Host fixtures used in-memory articles and created no test notes or external
requests. The pre-existing unpublished VideoCaptioner host assets and plugin
state are restored from backup after validation, along with the original
layout; the source VideoCaptioner checkout is not changed. Host installation
and GitHub's default branch therefore deliberately have different assets.
RSS embeds commit/time metadata, so separate builds are not claimed to be
byte-identical.

This verifies the Windows desktop session and controlled article content.
macOS, physical mobile devices, cold start, sync, live external feeds/accounts,
and new speech synthesis were not tested this run. Reader remains at upstream
4.7.9 / Dashell default `68e8828`, formal release 4.4.7, with no changes.
Local evidence is retained in the task's `dashell-upstream-20261023` temporary
evidence directory. No new Release is published by this merge.
