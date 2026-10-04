# RSS article filenames — 2026-10-04

## Problem and change

The importer used `material.md` for every article. Reader then used that basename
for automatically created reading notes, producing `material (2).md`,
`material (3).md`, etc. The article title only appeared in the enclosing folder.

RSS now writes `Article title.md`, `Article title - 译文.md` and
`Article title - 改写.md` for supplied versions. The naming helper reuses the
existing filename sanitizer and additionally protects Windows reserved names,
Obsidian link delimiters, control characters, UTF-8 length and truncated
surrogate pairs. Independent material folders prevent same-title overwrites.
The version manifest records the actual filenames. Reader accepts safe Markdown
siblings and still checks material identity before switching versions; old
fixed-name manifests remain readable.

New automatic reading notes retain the descriptive filename and version suffix.
For legacy `material.md` exports, Reader uses the manifest title when creating a
note. Existing explicitly linked notes are not recreated or renamed on load.

## Existing-file repair

A separate, one-time repair in the designated desktop test vault backed up the
affected Markdown files, both plugins' persistent data, and the workspace before
renaming. Two existing articles and their two linked reading notes now use article
titles. An empty note from an earlier QA article was renamed to its identifiable
QA title, retaining its contents and old source reference.

Renames used Obsidian FileManager. The repair also updated manifests, RSS local
file references, saved article paths, Reader's note associations, per-file progress
and backups, and restored the workspace with the updated paths. The original
four subscriptions, preferences and Velocity theme were retained. No automatic
bulk migration is included in the distributed plugin.

## Validation

- Full RSS unit suite: `Test Files 317 passed (317)`, `Tests 5051 passed (5051)`.
- Full Reader suite: 422 passed, 0 failed.
- Final naming/import tests: 16 passed. Reader versions/note tests: 23 passed.
- RSS production build passed lint, type checks, platform and architecture gates.
- Reader production build and focused lint passed; the pre-existing sentence-case
  warning for the brand spelling `Dashell Reader` remains.
- Desktop host verified card click → title-named article and automatic note,
  three supplied versions, repeat-open reuse, translation rendering, and both
  plugins' reload/resume behavior.
- After renaming existing files, both real articles reopened from their RSS
  entries without duplicates. Reading percentages, progress backups and note
  associations were checked. QA files and records were removed after testing.
- Host diagnostics retain three earlier `ResizeObserver` notifications; this
  check does not claim an error-free host. Physical mobile devices were not tested.

## Architecture and delivery

This round adds a filename policy helper to the existing importer responsibility;
RSS `main.ts` has no additional changes. Reader's note creation uses its existing
material parser. No dependencies, thresholds, baseline exceptions or runtime
cycles were introduced. The pre-existing large-file observations remain.

Candidates were installed locally in the designated vault. No push or release
was performed. The repair backup and host evidence remain outside the source
repositories and vault.
