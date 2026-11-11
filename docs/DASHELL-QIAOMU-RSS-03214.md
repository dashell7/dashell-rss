# RSS 0.32.14 selective adaptation — verified integration, 2026-11-11

Source: Qiaomu AI RSS official tag `0.32.14`, commit
`d076afcdacc8d51f48df27f50a82943649a099e5`, published
2026-11-09T10:15:31Z. Compared with official `0.32.13`
(`c64bab8ca0647e72b414a14bb6494dc983ea4e33`): nine commits, 20 files.
Unreleased main is not the adaptation source.

Candidate branch `fix/rss-03214-sync` starts from Dashell's actual default
`codex/dashell-rss-upstream-sync` at
`c6833dbcce871059a02721f3c214c7c0e3ad4cfc`. Formal manifest/package and
public Release were **2.7.4** at that initial base. On November 11 the
candidate merges actual default `d5bd15210bb48c8743d616244280e039f4df4fb5`
and preserves formal **2.7.5**, its cross-page search/subscription recovery
and all release changes. This daily sync creates no new Release.

## Selected change and owner

Refreshing subscriptions from the reading workbench now renders the latest
locally refreshed item with the same feed/article identity. Before the fix,
the list changed but the open body kept its old display snapshot; a new
regression reproduced that stale body before the implementation changed.

The workbench owns this rendering lifecycle. The existing refresh callback
still owns feed requests/merging, and the existing renderer owns article
content/three reading modes. No storage or transport owner is introduced.
After refresh, reopen only if the selected article/request generation is
still current. Preserve mode and scroll offset; avoid another open timestamp,
auto-mark-read or consumption of a newly set later flag. A newer article,
channel change or disposal wins over an earlier refresh. Refresh errors keep
the body and restore the button. Retry of a failed refreshed render also
uses the refresh path without new open-status effects.

Preflight: `src/dashell/workbench.ts` only production change; its existing
options seam and imports remain. No main.ts change/import, runtime cycle,
service-to-UI dependency, new suppression, dependency/lockfile or CSS change.
The small `recordOpen` method keeps opening side effects distinct from a
body refresh while respecting the existing complexity limit.

## Assessed exclusions and limits

The Dashboard already has filtered bulk read/unread entry points, including
Reader delegates. Do not add a second workbench batch UI using Qiaomu's
`readIds` identity, 5000-entry truncation or independent SaveQueue. Dashell
uses feed/article objects, user-state shards and its existing settings queue.
Upstream rollback-before-next-save is valuable but is not a drop-in contract
for that storage. This candidate does **not** claim Dashell's old Dashboard
bulk save already has equivalent confirmation, transactional rollback or
failure recovery. Any such work needs a separate design and failure tests
for shard/user-state and concurrent edits; it is not included here.

Cloudflare origin budgets, deployment logging, failover notices, health
streaks and authenticated drills are Qiaomu server/deployment responsibilities.
They do not belong in Dashell's existing client request budget. Upstream
branding/update notes/version changes are also excluded. Existing product
boundaries for backend identity, speech, storage and VideoCaptioner remain.

## Verification and host blocker

The new stale-body regression failed on the original source and passed after
the fix. Tests cover fresh item replacement, scroll/mode/status retention,
one request for repeated clicks, navigation/channel races, failure and
disposal. The full unit suite with coverage, final related suite, zero-warning
lint, main/test types and complete build/compliance gates pass; raw counts
and coverage appear in the external assessment. Architecture preflight and
diff report show no new threshold crossing/importer/cycle. Early candidate
complexity and mock return-type failures were corrected without weakening
rules. Required hooks remain enabled.

2026-11-10 audit: production **zero findings**; full tree **17 moderate,
0 high/critical**. The existing lockfile/dependency tree was not changed.
This is a current diagnostic result, not a reuse of October's finding counts.

## November 11 integration acceptance

The designated migrated vault is `G:/qiaomu-reader-english`, registered
`72af7e9296446625`. The prior Reader UX task completed; no other vault was
used. Current installed RSS was verified byte for byte against public
**2.7.5**, so it was not the historical VideoCaptioner candidate. Its
independent source/candidate was not modified or integrated.

After fresh backups, the combined candidate loaded in Windows Obsidian
1.15.1. A real Dashboard workbench and renderer used an in-memory synthetic
feed/article; refresh replaced old with new body, retained 90px scroll and
original mode, and made no further open/read/later-status update. A second
click made one request. A controlled translation renderer retained its
mode. A rejected refresh kept the current body and re-enabled retry. No
real subscription/network request or user feed update was made by fixtures.

The combined full suite passed **347 files / 5518 tests** with coverage
statements **75.21%**, branches **66.68%**, functions **73.97%**, lines
**76.41%**. Full build, zero-warning lint, main/test TypeScript and all
architecture/platform/CSS/document gates passed; hooks remain enabled.
Dependencies and lockfile versions were not changed by this integration;
only the inherited release root version advances to 2.7.5. November 10 audit
results above remain historical, not a fresh November 11 audit.

Original public assets and layout were restored. All **26 Markdown files
and 63 plugin files** were byte-identical to this run's backup, with no QA
notes or extra plugin files. Functional checks captured no errors. Restore
captured ResizeObserver notifications and one Reader progress JSON
verification warning; final idle preservation was verified, and diagnostics
are retained. No physical mobile/macOS, candidate cold start, synchronization,
real subscription/provider or speech acceptance is claimed.

Evidence: `C:/Users/zhangbo/AppData/Local/Temp/dashell-upstream-20261111/`,
including combined tests/build logs, host refresh and preservation JSON.
The November 10 assessment and audit keep their original date.
