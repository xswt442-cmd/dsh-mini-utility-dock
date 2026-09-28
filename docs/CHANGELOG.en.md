# Changelog

Release notes are generated from the matching version section; newest first.
For Chinese, see [CHANGELOG.md](CHANGELOG.md).

## 0.7.0 - 2026-09-29

### Changed

- `dsh-plugin-docs` names no document. Which pairs to check, their paths and the shape each is compared with come from a `--config <module>` the calling repository supplies, exporting an array of `{ name, zh, en, shape? }`. `shape` defaults to `markdown` (heading-level sequence and code-fence languages); `changelog` compares releases, sections and per-section item counts. A document absent from that configuration is not compared, so a caller's `docs:check` passes `--config`.
- This package's `CHANGELOG.md`, `CHANGELOG.en.md` and `RELEASING.md` move into `docs/`; the repository root keeps the two READMEs, `LICENSE` and `AGENTS.md`. The npm package ships the changelogs at their new paths.

## 0.6.0 - 2026-09-28

- New `dist/host-http.js` (marker `dsh-host-http`): the host half's reply glue becomes one block — `sendJson` (always `no-store`), the POST gate, the browser authorizer, `optionalSessionId` — so a reply policy has one definition. An already published vocabulary (`need_post`, Chinese wording, the echoed `action`) is a `policy` override, so no public identifier changes.
- `createBrowserAuthorizer` takes accessors, not values: a service reload reassigns a host half's Connection to `null` and later to a new instance, and the value-shaped version would keep handing requests to a destroyed Connection.
- The comments that ride verbatim into a consumer's repository with the launcher and host-http fragments now state the facts: no sentence misdescribes what the other copies do, and host-http's analogy to a guard-block name says where that name comes from.
- `dsh-mini-utility-dock`'s `sync`/`check` reject a file whose marker ranges overlap (`<A> <B> </A> </B>`) and leave it unwritten, closing off the corruption the bottom-up splice could previously produce.
- `dsh-plugin-parity` compares the `dsh-host-http` block byte for byte, and its block-position assertion now covers all three host blocks.
- The parity bin's "private implementation outside the blocks" scan matches code shapes only: both the bracketed and the destructured Fetch Metadata read count, `LOOPBACK_HOSTNAMES` is caught on assignment but not comparison, and a composite heuristic that could false-FAIL a reasonable repository is gone — so a comment that explains why a helper is not a second guard no longer reads as drift.
- The parity bin's block comparison strips each block's common indentation, so a consumer that indents its markers by 4 spaces or a tab is no longer reported as drift; `--fleet` naming a repository that is not a member now fails with a non-zero exit instead of the "skipped" line reading as a pass.
- `dsh-plugin-docs --base` no longer dies inside `git diff` on an all-zero SHA — which is what `github.event.before` carries for a new or force-pushed branch; it notes that there is no previous state and still completes the structural checks.
- `dsh-plugin-docs` now compares the `Unreleased` section for version, section and item structure — it is the most-edited section each round and was previously outside the check.
- Tests filled in: process-level behavior for the two diagnostic bins, decision-level behavior for `dist/loopback.js`, `dist/guard.js` and the new fragment, and one `FRAGMENTS` integrity assertion, with a paired case for each behavior change above.
- Maintenance: CI installs with `npm ci --ignore-scripts` and caches npm, both workflows run `docs:check`, syntax checks cover `bin` and `dist`, `publish.yml` gates on the tag being an ancestor of `main`, and `homepage`, `bugs` and `author` are filled in. Being dependency-free, this package now tracks `package-lock.json` so `npm ci` and the cache have one (reason in `.gitignore`).

## 0.5.1 - 2026-09-25

- Fix the launcher disappearing after a hot reload: the claim is released with its owner, which wakes the other copies to register again instead of requiring a full page reload.

## 0.5.0 - 2026-09-24

- New `dist/launcher.js` (marker `dsh-utility-launcher`): one icon at the bottom-left that opens a menu of utility panels, assembled through the host's slots rather than a page-local protocol. Exactly one copy runs per page (the first to load wins a `window` mutex and declares the menu seat `createhelper.utility.item`) and every other copy adds one row to it; consumers maintain it with `launcher:sync` / `launcher:check`.

## 0.4.0 - 2026-09-24

- Remove `dist/bootstrap.js` (the page-local dock bootstrap fragment) and its `FRAGMENTS` row: it appended a self-measuring `position:fixed` container to every consumer's `document.body`, so it necessarily floated above the page and covered the composer's own controls. Consumers now register the host's `sidebar.footer.action` seat, embed no fragment in `lib/client.js`, and have dropped `dock:sync` / `dock:check`.
- The two host-side fragments (loopback predicates, host guard) are unchanged, so consumers stay pinned to `0.3.0` and `loopback:check` / `guard:check` keep comparing against that version.

## 0.3.0 - 2026-09-22

- New `dsh-plugin-docs`: a bilingual docs structure check, adopted from the `check-docs.mjs` copy each plugin repository carried. Same interface: no arguments checks the README and CHANGELOG pairs for structural alignment, `--base <revision>` requires bilingual pairs to change together. This package's own bilingual docs are now checked by it too.
- README gains badges and a positioning statement; the two diagnostic bins (`dsh-plugin-parity`, `dsh-plugin-docs`) are documented with their purpose and opt-in mechanism; the package description states the "family shared assets" scope.

## 0.2.0 - 2026-09-21

- New `dsh-plugin-parity`: a cross-repository drift check, adopted from the copy each plugin repository carried. The member list is caller-supplied via `--member <repo>:<export>`; this package names no repository of its own. Without `--member` it runs the static checks only and discovers every repository that embeds the host-guard block.
- The copy in each plugin repository is gone with it; the bilingual-structure half of `docs:check` stays with the repositories.

## 0.1.8 - 2026-09-21

- The two host-side fragments drop "sibling" and state the design goal directly: a plugin ships standalone, with nothing else required.

## 0.1.7 - 2026-09-20

- The two host-side fragments no longer state how many consumers exist ("all three plugins", "the three disagree", "diverged three times" give way to wording that names no count): a fragment is embedded verbatim into a consumer's repository, where no reader can check that count.

## 0.1.6 - 2026-09-20

- Fix the `allowRemoteHost` note in `dist/guard.js`: it read "stop being admitted", the opposite of what the code does — that mode skips both checks, so it admits them.

## 0.1.5 - 2026-09-17

- Documentation maintenance: README and CHANGELOG cleanup. Fragments and command behavior are unchanged, so consumer pins need no update.

## 0.1.4 - 2026-09-16

- Add a cross-repo consistency section to the READMEs, separating two different properties: **local** -- a consumer's `npm test` runs `loopback:check` / `guard:check` to compare both fragments byte-for-byte against the version of this package it pins, covering both "edited a block by hand" and "forgot to re-`sync`"; and **cross-repo** -- this package's published versions are immutable and consumers pin an exact version, so "all three pin the same version" already implies "all three hold byte-identical blocks".
- That section also records that a consumer's `scripts/guard-parity.mjs` is a **manual diagnostic, not a CI gate**, because the property it asserts cannot hold while a peer checkout resolves to a different branch, which would make it report false failures.
- The LICENSE copyright holder is now `xswt442-cmd`.

## 0.1.3 - 2026-09-14

- Add two host-side fragments. `dist/loopback.js` (`dsh-loopback-helpers`) exports `LOOPBACK_HOSTNAMES`, `normalizeHostValue`, `hostHostname`, `isLoopbackName` and `isLoopbackAddress`. `dist/guard.js` (`dsh-host-guard`) exports `portOf`, `GUARD_REASONS`, `DEFAULT_GUARD_POLICY` and an internal `bindGuard()` factory; a consumer passes its own error codes and wording as `policy`, so the enforcement does not fork per plugin.
- `sync` / `check` now maintain **every** marked fragment in the target file, applied bottom-up in `FRAGMENTS` order, instead of requiring exactly one block. Single-block callers are unaffected.
- Correct the READMEs and the package description: each host-side fragment's responsibility, the fixed order, and why `bindGuard` is not exported.
- Add tests for multi-block sync and idempotent `check`, block order, the absence of `import`/`require` in either fragment, and `bindGuard` staying private with no duplicated predicates.

## 0.1.2 - 2026-09-06

- Fix the README `npm run dock:embed` examples: add the previously missing `dock:embed` script to `package.json` and switch the usage to `npm run dock:embed -- check|sync path/to/client.js` (npm argument passing needs the `--` separator, and the CLI takes `sync|check` subcommands, not `--check`). A new smoke test extracts the documented commands from both READMEs and runs them, preventing docs/script drift.

## 0.1.1 - 2026-09-04

- Normalize `label` in `register()`: a missing, blank, or non-string label falls back to `id`, so no item renders `aria-label="undefined"`.

## 0.1.0

- Add the Mini Utility Dock protocol v1 bootstrap.
- Add `sync` and `check` commands for self-contained DSH client bundles.
- Validate icons, registration ownership, placement, and load-order behavior.
