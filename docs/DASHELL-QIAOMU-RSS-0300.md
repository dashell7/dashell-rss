# Qiaomu AI RSS 0.30.0 adaptation

Date: 2026-10-19. Dashell base: `4176022a5e60152df6c504da45ef3adea8e17ec9`,
actual default branch `codex/dashell-rss-upstream-sync`.
The manifest remains **2.7.3**; this is a source update, not a Release.

## Upstream evidence and scope

- [Official 0.30.0 Release](https://github.com/joeseesun/qiaomu-ai-rss/releases/tag/0.30.0),
  commit `1af82c0d1c7062b55701e3e49b5d5dd3c8832c37`.
- [0.29.2 to 0.30.0 comparison](https://github.com/joeseesun/qiaomu-ai-rss/compare/0.29.2...0.30.0):
  four commits; source resolution/input, initial body persistence and source-picker chrome.
- References: `src/feed-resolver.ts`, `src/source-input.ts`, `src/subscriptions.ts`
  and `docs/xml-subscription-design.md` at the pinned tag. Source attribution
  and GPL-3.0-only licensing remain in [NOTICE](../NOTICE.md).

## Adapted behavior

1. The existing **Add feed** preview identifies RSS, Atom, RDF, JSON Feed and OPML
   from their contents. The preview rejects malformed XML, XML DTD/entities,
   unsupported addresses and sources over 5 MiB. Filename and response MIME do
   not determine the source type. Existing media-platform resolution is retained.
2. HTML discovery reads only sanitized, declared alternate feed links in the
   document head, resolves relative links/base URLs and checks at most eight
   distinct HTTP(S) candidates. One unambiguous result is loaded automatically;
   multiple results or partial failures require an explicit choice. A prefilled
   title cannot bypass that choice. Verification is sequential and uses the
   existing shared transport; no new request pool or limiter is introduced.
3. An OPML URL opens the existing selective import preview. Its additive mode,
   groups, duplicate handling and explicit overwrite confirmation remain intact.
   Local file import keeps its established entry and controls; the upstream
   discovery/library UI and its separate undo/store are not copied wholesale.
4. Changes to the address or encoding, or closing the dialog, invalidate old
   previews. A 30-second deadline leaves a retry path; a late result cannot
   overwrite the next input. Chinese input confirmation and repeated Enter/Save
   cannot submit duplicate operations. Unabortable transports keep their slots
   in the existing scheduler until their real completion.
5. Adding a directly previewed source reuses the validated downloaded document.
   The existing parser still applies the current title, folder, encoding,
   retention, tagging and media settings. Documents are reused only for the same
   URL and encoding. Legacy rss2json fallback previews do not carry a reusable
   document and retain their existing add-time fetch behavior.
6. Add commits are ordered and recheck cancellation/disposal and duplicates.
   A failed save removes only that pending addition, orders a compensating
   settings snapshot and permits retry. Optional image/view refresh failures
   cannot turn a durable subscription into a reported add failure.

## Existing body storage already satisfies the upstream change

`FeedStorageRepository.persistSettings` writes article shards before subscription
metadata. Legacy JSON stores both together. No BodyStore migration, second body
cache or dirty-body flag is needed. Host tests confirm the newly added full body
is on disk before reload and remains available after reload.

Dashboard pagination, media previews, Reader/Player handoff, learning records,
shard/user-state storage and all prior adaptations remain their existing owners.
The in-place menu-hiding patch has no corresponding control in Dashell's separate
modal UI. No upstream curated service, account or second speech player is added.

## Architecture and verification

Risk: high, because source parsing, asynchronous UI state and durable subscription
commit behavior cross existing module boundaries. Preflight and final architecture
checks enforce service dependency direction, importer allowances and runtime
cycles. `main.ts` only forwards the existing service option contract; it shrinks
by five lines. No new main importer, cycle or threshold crossing is introduced.

Regression cases cover stale/closed/timed-out previews, IME and duplicate input,
explicit source choice, content validation, partial discovery, cancellation,
preview-body reuse and feed options, save rollback/retry, disposal and concurrent
duplicates. The former characterization assertion that pinned the failed-add
ghost entry is deliberately updated for this behavior fix; the legacy notice
wording is preserved.

Build, full-suite and host evidence are recorded for this candidate. Host scope:
Windows Obsidian **1.14.4**, exact registered vault **F:/qiaomu-reader-english**,
plugin **dashell-rss 2.7.3**. A loopback HTTP fixture exercises real Obsidian
transport, DOM actions and actual vault-shard writes. A targeted adapter-write
failure is explicitly injected to verify recovery; it is not a physical disk
failure or a claim about external feed-service availability.

Host acceptance includes IME, late response isolation, one network download for
preview plus save, single addition on double Save, full-body disk/readback and
reload, website choice, additive OPML preview/duplicate skipping/cancel, malformed
input, write failure and successful retry. Layout is checked at actual 400px and
1280px window widths, with light/dark host theme classes. This does not establish
mobile-device or macOS compatibility, real external redirects/services, cold
startup, or synchronization between devices.

The host originally runs an unpublished VideoCaptioner candidate. After temporary
candidate installation and acceptance, its exact original three assets and backed
up plugin data are restored; four original subscriptions, 100 articles and 64
Markdown notes are preserved. The separate dirty VideoCaptioner source checkout
is not modified. GitHub receives this source adaptation only. Local evidence is
kept under the task's `dashell-upstream-20261019` temporary evidence directory.
