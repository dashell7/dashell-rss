# 0016: Dashell Reading Handoff

**Status:** accepted (Dashell customization)

**Date:** 2026-10-04

[ADR index](README.md)

## Context and problem

Dashell RSS already manages subscriptions, while Dashell Reader provides reading,
dictionary lookup, vocabulary, speech and AI. Keeping two article readers creates
duplicate settings and progress ownership. Combining both plugin codebases would
also make independent upstream updates and installations harder.

## Decision

Keep the plugins separate. RSS owns discovery, extraction, local material files,
read/star state and learning sessions. Reader owns text rendering, appearance,
per-file progress and language-version selection. Player owns media playback.
Opening an article card imports it once and delegates to Reader. A versioned local
frontmatter manifest links supplied original, translation and rewrite files;
references are limited to fixed sibling filenames.

Clarification (2026-10-04): the three modes remain fixed, but filenames now use
the article title, with translation/rewrite suffixes. Reader accepts safe Markdown
sibling names and validates the shared material ID; traversal remains forbidden.
Existing manifests using `material.md`, `translation.md` and `rewrite.md` remain readable.

Media preview adjustment (2026-10-04): podcast and video card clicks keep the
native RSS Dashboard preview, player and playlist. Preview does not require a
download or Dashell Player. The existing reader-location preference controls
media previews and is exposed as a media-specific setting. Explicit local
media-learning actions remain separate from normal preview.

## Consequences

Cards have one reading destination and saved materials remain ordinary local
files. Existing saved Markdown notes are reused without overwriting user edits.
Reader chooses the most recently read version from its own progress store;
RSS does not calculate or persist a second reading percentage. Hidden RSS reading
preferences retain their values. Unavailable target plugins cause a specific
error before downloading, and opening failures preserve completed local files.

Independent builds remain possible, but both plugins must be enabled for the
integrated reading workflow. Older Reader builds open via their existing API
without automatic version resumption. Supplied translations and rewrites are
not claimed to be live AI generation. Normal feed and card interactions no
longer open the earlier RSS workbench; removing its remaining code is separate
work.

## Considered options

- Merge plugin repositories: easier internal calls, but couples releases and
  upstream merges across unrelated responsibilities.
- Keep both readers active: permits standalone RSS reading, but duplicates
  configuration and breaks the continuous learning workflow.
- Delegate reading using local files and a small capability boundary: chosen
  because file provenance and state ownership remain clear.

## Related

[Implementation and version protocol](../DASHELL-IMPLEMENTATION.md)
