# Qiaomu AI RSS 0.32.7 → 0.32.9 selective adaptation

Evaluated on 2026-10-28. The released range contains five commits, from
`6c313c50bf29f4bf4a4e5eb58b79d96ee4a3b4b7` to
`bcd0ef8cc0c18f8751fec6a51c5b0697d061d330`; unreleased `main` is excluded.
The target base is actual default branch `codex/dashell-rss-upstream-sync`
at `786f2834d72bf7e0559f1bb324f9c1ed5b998459`. Manifest remains **2.7.4**.

## Selection and ownership

- 0.32.8 (`76f182b`, `02d652b`, merged in `b261f12`) fixes Obsidian tablet
  text-button padding collapsing icon SVGs and improves narrow layouts.
  Dashell's `reader-chrome.ts` and `workbench.ts` have the corresponding
  controls, so use native `clickable-icon` buttons, nonshrinking SVGs,
  wrapping sidebar/reading action groups, and 44px mobile controls.
- Retain Dashell's four filters, Dashboard entry, channel picker, refresh
  ownership, three reading versions, outline, learning actions, and existing
  reading-settings portal. Search uses 36px desktop / 44px mobile height and
  stable focus bounds; dates use the host's muted text instead of faint text.
  Existing neutral settings surfaces and Chinese heading tracking already
  cover the relevant upstream polish; do not replace them with another UI.
- 0.32.9 (`bcd0ef8`) changes Edge-to-device fallback inside `@qiaomu/speech`.
  Dashell RSS does not have that dependency or its speech settings/player.
  Keep the existing Reader/Player handoff rather than adding another speech
  owner. This is an assessed product boundary, not a failed integration.
- The prior admin-move merge (`3163135`) remains inside the previously excluded
  Qiaomu server/identity contract. Version notes, branding and release promotion
  are not copied. Original GPL attribution remains in the adapted files.

## Change contract and architecture

Medium risk: related responsive UI surfaces, no persistence or lifecycle change.
Acceptance: visible icons, no clipped or overlapping sidebar controls, bounded
reading actions, mobile targets at least 44px, stable search focus, and existing
refresh/search/channel/settings behavior. Owners remain `reader-chrome.ts`,
`workbench.ts`, and their two scoped stylesheets. No new responsibility,
dependency, storage, timer, request handler or service is introduced.
`main.ts`, architecture baselines and lint suppressions remain unchanged.

## Verification

- A new unit regression fails on the original code because icon/channel
  buttons match `.is-tablet button:not(.clickable-icon)`, and passes after the
  native-class fix. It also checks the existing search click and focus.
- Full unit suite: **337 files, 5274 tests passed**. Coverage thresholds pass:
  statements 74.92%, branches 66.28%, functions 73.50%, lines 76.09%.
- Full build covers zero-warning source ESLint, main/test TypeScript,
  architecture, platform, CSS scope/no-important, compatibility and document
  gates. No threshold, suppression or dependency changes.
- Designated existing Windows host `F:/qiaomu-reader-english`, registered ID
  `f3d4f84f4640589d`, Obsidian **1.15.0** (installer UA still 1.12.4).
  Fresh backup: nine original Markdown files, RSS 14 files, Reader 18 files,
  current settings/learning state and layout. Candidate manifest was refreshed
  from disk to avoid the host's cached 2.7.3 manifest.
- Actual mounted sidebar and reading toolbar each pass **42** combinations:
  light/dark, desktop/phone/tablet host classes, widths
  220/280/320/390/600/768/1024px. Check icon bounds, sidebar overlap/clipping,
  mobile target sizes, toolbar bounds and search focus geometry.
  Real Windows rendering with simulated platform classes is not physical
  iOS/Android acceptance.
- Actual refresh button issues one controlled callback while disabled, recovers
  after completion; Chinese search, clear, Escape, channel picker and reading
  settings work. No external subscriptions or paid services are requested.
- Actual native Obsidian popout migration preserves the mounted workbench;
  search focuses in its new document, Escape closes search, and reading
  settings opens in the owning popout document. Controlled action smoke
  captures no errors.
- Dark 320px and light 600px sidebar/reading screenshots inspected. First
  screenshot cropping used window origin and was corrected to the actual root
  bounds. Initial reading checks included a closed details panel; corrected to
  browser visibility. The independently observed desktop 220/280px action-row
  overflow was fixed by wrapping existing actions, then all combinations passed.

Restoration passed: all nine original Markdown files, all RSS 14 files and
Reader 18 files are byte-for-byte identical to the fresh backup, including
Reader's local database-creation candidate assets. RSS retains the independent
VideoCaptioner candidate (host manifest 2.7.3), not this sync's source/build.
No QA notes remain; layout and window bounds are restored. Restoring the
original reading layout generated three normal daily Reader rescue files;
they were preserved outside the vault before restoring the original plugin
file set and matching Reader's in-memory settings/progress/cache to disk.

RSS dependency audit rerun on 2026-10-28: production zero vulnerabilities;
full tree seven moderate findings, zero high/critical. Package and lockfile
are unchanged; audit gates are not weakened. Reader audit was not rerun.

Evidence and fresh backup are local at
`C:/Users/zhangbo/AppData/Local/Temp/dashell-upstream-20261028`.
Final GitHub CI results are recorded after completion.

Not covered: physical mobile/iOS, macOS, cold start, cross-device sync, real
external feeds/accounts, or new speech synthesis. Prior dependency-audit counts
remain dated historical results unless explicitly rerun below. No Release or
official-directory submission is authorized by this daily sync.
