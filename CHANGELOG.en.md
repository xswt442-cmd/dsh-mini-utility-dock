# Changelog

## Unreleased

- Fix the README `npm run dock:embed` examples: add the previously missing `dock:embed` script to `package.json` and switch the usage to `npm run dock:embed -- check|sync path/to/client.js` (npm argument passing needs the `--` separator, and the CLI takes `sync|check` subcommands, not `--check`). A new smoke test extracts the documented commands from both READMEs and runs them, preventing docs/script drift.

## 0.1.1 - 2026-09-04

- Normalize `label` in `register()`: a missing, blank, or non-string label falls back to `id`, so no item renders `aria-label="undefined"`.

## 0.1.0

- Add the Mini Utility Dock protocol v1 bootstrap.
- Add `sync` and `check` commands for self-contained DSH client bundles.
- Validate icons, registration ownership, placement, and load-order behavior.
