# Saved article links - 2026-10-04

## Result

The Dashell article importer unwraps sanitized body anchors before converting
them to Markdown. Linked words become ordinary reading text. Their children,
including bold/italic text and images, remain intact. The same policy covers
original, translated and rewritten versions. Source URLs stay in frontmatter;
the original fetched content and RSS preview links remain intact.

The Reader deliberately excludes anchors from hover and click lookup
(`src/english-lookup.js`, eligibility check). Turndown previously converted body
anchors into Markdown links, keeping those words outside lookup. This fix belongs
at the RSS save boundary; no Reader lookup or preview behavior changed.

## Scope

This round adds four lines to `src/dashell/importer.ts`, one regression test,
one changelog entry and a host verification/repair script. No dependency, settings,
manifest, storage schema, media player or Reader production code changed.
Architecture preflight and final gates passed, without new imports of `main.ts`,
dependency-direction violations, runtime cycles or threshold exceptions.

Existing local files continue to be reused. The fix does not automatically
rewrite every saved note or user edit. The single reported article was repaired
with a verified backup: a Markdown parser located its nine link spans, only those
spans were changed, and rendered text/formatting matched the old article after
unwrapping anchors. Its path, frontmatter and reading-note association were kept.

## Verification

- Regression test failed first because saved body links still rendered as anchors.
- Focused importer suite: 9 tests passed. Covers original/translation/rewrite,
  nested formatting, linked images, relative URLs, adjacent labels, named anchors,
  unsafe hrefs, source retention and unchanged preview/source content.
- `Test Files 318 passed (318)` / `Tests 5070 passed (5070)`.
- Focused ESLint, platform and architecture checks passed. Production build passed
  full lint, compliance, TypeScript/test types and bundling.
- Installed and reloaded in the designated existing Obsidian test vault, using
  the registered vault session and guarded asset installer. Desktop Obsidian title reported 1.14.4
  (installer user agent reported 1.12.4). RSS candidate is
  `2.7.0-beta.2-dashell.1`; Reader is `4.4.5`.
- Real-vault importer check saved three named QA versions, preserved formatting,
  image URLs and source, then removed its temporary folder. The check used an
  isolated in-memory material record and the real Vault API, leaving learning
  records untouched.
- The reported article initially had nine body anchors. After repair it had zero.
  A mousemove over a formerly linked sample word triggered the lookup callback
  and displayed a hover dictionary card with its source sentence.
- Material associations/sessions, reading notes, Reader settings and reading
  position were checked against the backup. Test-generated progress was removed.
  Four subscriptions, Velocity theme and original workspace layout were retained.
- Diagnostic buffer contained only earlier media/ResizeObserver errors at
  03:15-03:22, predating this round's tests; no new error entry appeared.

The source checkout, registered vault ID, installed asset hashes, backups and
host reports are kept locally and are excluded from this public project report.

No mobile device was tested. This is a local installed candidate; no commit,
push or release was made.
