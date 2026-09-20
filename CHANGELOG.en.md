# Changelog

## 0.1.6 - 2026-09-20

- Fix the `allowRemoteHost` note in `dist/guard.js`: it read "stop being admitted", the opposite of what the code does — that mode skips both checks, so it admits them. The JSDoc was already right; only this inline comment was inverted.
- The fragment's bytes change, so consumers must re-run `guard:sync` and raise their pin to 0.1.6.

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
