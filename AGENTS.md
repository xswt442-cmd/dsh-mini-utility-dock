# dsh-mini-utility-dock

This repository contains the DSH plugin family's host- and client-side source fragments and their embedding CLI.

## Engineering

- This repo is the source of the fragments the consumer plugins embed. `sync` / `check` maintain every marked block in the target file, bottom-up in `FRAGMENTS` order, so a consumer keeps exactly one synced copy.
- `dsh-utility-launcher` (0.5.0) is the client-side assembly: one icon on the host's `shell.overlay` layer plus the menu it opens, with every consumer contributing one row to the child slot it declares. Do not reintroduce a page-local container — the layer, its click-through behaviour and the stacking order belong to the host.

## Changelog

- `CHANGELOG.md` and `CHANGELOG.en.md` stay in step: the same sections, the same number of bullets, the same order.
- One bullet per change — what changed and why it matters, in at most two short sentences — counting prose, not the inline code identifiers a bullet names (roughly 120 CJK characters or 240 letters of it, and a whole version section stays under about 900 CJK characters). A version section is published verbatim as the GitHub release notes, so its reader is someone installing this package, not its historian.
- No implementation narrative and no root-cause essay. "It used to do X, which was wrong because Y, so now Z" is one bullet about Z; the rest belongs in the commit message or a handoff note. A bullet that needs a subordinate clause to justify itself has one clause too many.
- `Unreleased` records what a reader other than the author would notice. Deferred work and "X was left alone because it needs a product call" are handoff notes, not changelog entries.
- Do not name a consumer repository. Plugins depend on this package, never the other way round, so a reader of this repository alone cannot check what a sibling checkout does — describe the role instead ("a consumer plugin", "the host halves that embed this block"). A fragment's own header comment may state what it exists to prevent, as long as it names no repository.

## Verify

```sh
npm test
node bin/dsh-plugin-docs.js
for f in bin/*.js dist/*.js; do node --check "$f"; done
node bin/dsh-plugin-parity.js --self-test
npm pack --dry-run
```
