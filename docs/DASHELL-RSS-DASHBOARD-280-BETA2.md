# RSS Dashboard 2.8.0-beta.2 selective adaptation

User-requested prerelease source: `amatya-aditya/obsidian-rss-dashboard`, tag
`2.8.0-beta.2`, commit `b9b812c80ed3959e0714280c742dca28bca93bf3`.
Published 2026-10-31T02:59:46Z. The beta.1 comparison starts at
`17a8084fc7cd116d0a6b99b4ed234d17d3629e5c`: 54 commits and 251 files.
This request explicitly selects a prerelease; daily Qiaomu checks still use
formal releases. Dashell starts at `6026454682178e47cbdd6f01a348e91b5a456fc0`.
The manifest/package remain 2.7.4. This is not a new public Release.

## Adaptation decisions

| Area | Delivered behavior / boundary |
| --- | --- |
| Tags | Optional background/text overrides, palettes and random colors, draft modal preview, global defaults with explicit inherited/future or future-only scope. Existing custom colors remain. Renames update articles, nested folder rules, feed custom names and media defaults; saved filters clear the renamed tag. Failed modal saves can retry without creating another tag. |
| Covers | Explicit current-page fetch button, three workers, repeat press stops new work while started requests finish. Reuses shared low-priority transport and existing feedId:guid user-state; OG, Twitter and bounded article JSON-LD declarations only. Closed lists/deleted feeds reject late results. No second request limiter, timeout owner, proxy or cover store. No separate per-card restore interface was imported. |
| Saved notes | 245-codepoint/252-byte filename stem with Windows/reserved-name checks. Existing three-version learning paths retain their 180-byte budget. GFM tables preserve escaped pipes/code spans, flatten unsupported spans deterministically and cap untrusted colspan allocation. Template-owned hero images are removed in HTML before conversion; raw Markdown code examples remain untouched. |
| Media | Twitch live/VOD route through the existing VideoPlayer. Focus mode hides auxiliary details and links. YouTube messages require current iframe source/origin; switch/destroy clears delayed seek and does not attribute YouTube progress to Twitch. Blank podcast audio falls back to enclosure. No second player/service is added. |
| Bluesky | Extracts the already fetched post page's mainEntity text, images or video poster; ignores OG avatars and replies. Short/image posts survive lead cleanup and pass the existing sanitization boundary. No new network endpoint/account contract. |
| Display | Title scale 50–200%, card press switch and reduced-motion gate, keyboard-only card focus ring, touch lightbox controls below, compact viewing stats, sticky-header seam and wrapping migration buttons. |
| Navigation | Optional mobile narrow-screen panel swipes default off, preserve native control gestures and restore pre-existing swipe marker. Existing Dashell reading handoff remains. Actual popout folder menus bind to their owning document; Escape closes picker, create-folder closes picker first, unload disposes it. |
| Preview / catalog | Feed preview retries clear stale state and reject outdated completion; follows image source precedence without treating video media as images. Disabling governed icons leaves other feeds alone. Removes Reddit only from bundled Discover suggestions, not user subscriptions. |
| Excluded | Upstream release/version/branding, mechanical architecture extractions and unrelated status-announcer ownership. Existing Dashell learning, three-version materials, Reader/Player identity, shard storage and Qiaomu product boundaries remain. No VideoCaptioner integration. |

`main.ts`, lockfile, runtime dependencies, architecture baseline and validation
thresholds are unchanged. Existing ESLint suppressions are only pruned, not
expanded. GPL and inherited notices remain.

## Validation

2026-10-31 local validation:

- `npm run build` passed the compliance, architecture, platform, CSS, document,
  stable-version, zero-warning ESLint, production/test TypeScript and bundle
  checks. No dependency or validation-threshold changes.
- Raw Vitest summary: `Test Files 347 passed (347)`; `Tests 5504 passed (5504)`.
  Full V8 coverage passed: statements 75.03%, branches 66.55%, functions 73.67%,
  lines 76.24%. Reader table saving, raw Markdown code preservation and template
  hero deduplication regressions failed before their fixes and passed afterward.
- Production audit: zero findings. Full audit: 27 moderate, zero high/critical;
  this is not a claim of zero development dependency vulnerabilities.

Actual Windows host: `F:/qiaomu-reader-english`, registered vault
`f3d4f84f4640589d`, Obsidian window version 1.15.0 (installer UA 1.12.4).
The built 2.7.4 candidate was temporarily installed after backing up notes,
both plugins, settings and layout. Actual installed Dashboard controls verified
cover stop after three in-flight requests, completion of the remainder and
user-state persistence on reload. Tag controls verified draft/cancel, inherited
versus future-only defaults, custom overrides, failed save retry and duplicate
click protection. Component harnesses used native Obsidian APIs and DOM for
folder Escape/create behavior, actual popout ownership, title scaling,
animation toggle, synthetic swipe cleanup and controlled media messaging.
The actual settings window's new tag editor was visually inspected on desktop.

Actual Reader preview, three-version Importer and vault writes verified
original DOM identity, translation/rewrite outline refresh and jumps,
sanitization, hidden preview images, preserved code, Markdown images, saved
version metadata, Reader TOC/body and unload/reload persistence. Five further
controlled note saves verified template hero deduplication in ordinary and
Reader saving, escaped table pipes/code, raw Markdown code, a 255-byte Unicode
filename and a 245-character ASCII stem. An initially hidden host window paused
animation frames; the fixture was rerun after foregrounding and revealing the
reading pane. Production outline scheduling was unchanged.

All QA notes/materials and helper listeners were removed, and layout/bounds
restored. Final byte comparisons matched all nine original Markdown notes,
all 14 RSS plugin files and all 27 Reader plugin files. The host retains its
independent VideoCaptioner RSS 2.7.3 candidate and Reader local missing-database
candidate; neither is the new remote default or a new public Release. The
Reader candidate source was untouched.

Host diagnostic logs contained 18 ResizeObserver notifications before QA and
46 after cleanup, with no other diagnostic lines. The successful three-version
smoke captured no errors; lifecycle notifications remain in the evidence and
are not represented as an empty log. Controlled loopback requests tested cover
and feed retry behavior. Iframe interception tested Twitch routing/YouTube
message boundaries, not actual external playback. No physical mobile/macOS,
cold-start, dual-device sync, external account, speech synthesis or live media
service acceptance is claimed. Narrow/touch behaviors have automated and
synthetic coverage, not physical-device acceptance.

Evidence directory: local Temp `dashell-dashboard-280-beta2-20261031`, including
the final coverage/build/audit logs, host QA results, original backup and
`restoration.json`. GitHub checks are verified separately against the pushed
default-branch commit. Manifest/package remain 2.7.4; no Release was created.
