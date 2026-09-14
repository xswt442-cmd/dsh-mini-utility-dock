# Changelog

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
