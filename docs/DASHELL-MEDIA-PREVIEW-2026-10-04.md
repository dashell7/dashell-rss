# Podcast and video preview — 2026-10-04

## Result

Normal podcast and video card clicks retain RSS Dashboard's native preview.
Podcast transport, episode list and playback settings stay with the existing RSS
player. YouTube embeds and direct-video previews use the existing RSS rendering
paths. Source-only video items retain the existing source-page fallback.
Preview does not create local learning files, require Dashell Player, or display
the added download/learning panel. Text and book materials still use Dashell Reader.

General settings expose the existing reader-location preference as
`媒体预览位置` when Dashell learning is active. Existing values are preserved;
main split, left/right sidebar, inline and external-browser options remain.
Switching to media also invalidates a preparing text request so it cannot open
Reader after the media selection.

## Scope and ownership

Medium risk: dashboard routing, learning-panel mounting and an existing setting.
No parser, storage format, dependency or player implementation changed. A shared
preview predicate keeps those boundaries consistent. `main.ts` delta this round
is zero; architecture gates report no new importer, cycle or threshold exception.
Native preview location and podcast-playing-leaf reuse remain authoritative.
Explicit local media-learning actions are separate from normal card preview.

## Verification

- `Test Files 318 passed (318)` / `Tests 5069 passed (5069)`.
- Full production build passed lint, TypeScript/test types, platform, architecture,
  CSS scope and compliance checks. Focused lint including the host script passed.
- Dashboard tests cover native media sidebar and inline routes with Dashell
  enabled, source-only video, normal text handoff, and stale text cancellation.
- Desktop Obsidian in the designated vault: actual subscribed podcast and YouTube
  cards opened native previews, with podcast episode list/source and YouTube embed.
  Preview created no files or learning records and opened neither learning plugin.
- Desktop inline podcast preview was also checked. Settings retained the existing
  location and accepted changes; the test restored the original value.
- The guarded installer backed up the installed plugin and workspace. The old
  candidate's learning module was unavailable to the initial live baseline, so
  the installer snapshot supplied the pre-test settings, shards and user state.
  Cleanup restored affected media states and workspace; learning data was verified
  semantically unchanged. Four subscriptions and the Velocity theme remain.

This verifies preview rendering and routing, not uninterrupted playback of every
external provider. No physical mobile device was tested. No push or release was
performed; the candidate is installed locally for testing.
