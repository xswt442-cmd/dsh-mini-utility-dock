# dsh-mini-utility-dock

[中文](./README.md) | [English](./README.en.md)

[![ci](https://github.com/xswt442-cmd/dsh-mini-utility-dock/actions/workflows/ci.yml/badge.svg)](https://github.com/xswt442-cmd/dsh-mini-utility-dock/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-mini-utility-dock?label=npm&color=4d6bfe)](https://www.npmjs.com/package/dsh-mini-utility-dock)
[![release](https://img.shields.io/github/v/release/xswt442-cmd/dsh-mini-utility-dock?label=release&color=16a3a3)](https://github.com/xswt442-cmd/dsh-mini-utility-dock/releases)
[![node](https://img.shields.io/static/v1?label=node&message=%3E%3D20&color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![downloads](https://img.shields.io/npm/d18m/dsh-mini-utility-dock?label=downloads&logo=npm&color=cb3837)](https://www.npmjs.com/package/dsh-mini-utility-dock)
[![license](https://img.shields.io/badge/license-MIT-22c55e.svg)](./LICENSE)

The DSH plugin family's shared assets: source fragments, an embedding CLI, and the cross-repo diagnostics and bilingual docs checks built around them.

## Fragments

| Fragment | Marker | Target file | Exports |
| --- | --- | --- | --- |
| loopback predicates | `dsh-loopback-helpers` | `lib/shared.js` | `LOOPBACK_HOSTNAMES`, `normalizeHostValue`, `hostHostname`, `isLoopbackName`, `isLoopbackAddress` |
| host request guard | `dsh-host-guard` | `lib/shared.js` | `portOf`, `GUARD_REASONS`, `DEFAULT_GUARD_POLICY` |
| host HTTP glue | `dsh-host-http` | `lib/shared.js` | `sendJson`, `CONNECTION_UNAVAILABLE`, `connectionUnavailable`, `REQUIRE_POST_REASONS`, `DEFAULT_REQUIRE_POST_POLICY`, `createRequirePost`, `createBrowserAuthorizer`, `optionalSessionId` |
| utility launcher | `dsh-utility-launcher` | `lib/client.js` | `registerUtilityLauncher`, `UTILITY_ITEM_SLOT` |

## Usage

Write the markers into the target file, then run the CLI. `sync` writes every marked block in that file and keeps the marker indentation; `check` exits non-zero when a block differs from `dist/`.

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
npm run dock:embed -- check path/to/shared.js   # equivalent entry inside this repository, target passed by the caller
```

## Constraints

- `dist/` is the single source; after a fragment changes, a consumer re-runs `sync`.
- The three blocks in `lib/shared.js` keep the fixed position `dsh-loopback-helpers` → `dsh-host-guard` → `dsh-host-http`, which is the `FRAGMENTS` order.
- `dsh-host-guard` uses the names `dsh-loopback-helpers` declares in the same file; `dsh-host-http` depends on neither of the two and embeds alone.
- `sync` replaces blocks from the bottom of the file upward; a file whose marker ranges overlap is rejected and left unwritten.
- A fragment contains no `import` or `require`; a consumer publishes standalone.
- `bindGuard` is not exported; a consumer declares its own guard export in the same file.
- Each plugin passes its own error codes and wording through `policy`; the enforcement is shared and an unknown key throws.
- `createRequirePost({ respond, policy })` defaults to the code `method`; `policy.method_not_allowed` overrides the code, the wording, and whether the rejected `action` is echoed.
- `dsh-utility-launcher` lands in the client half, and one page runs one copy of the assembly: the first to load wins the `window` mutex and declares the menu seat.
- `createBrowserAuthorizer({ getConnection, getConnectionSeen, guard, respond })` takes accessors, and the decision order is fixed:
  - A Connection that throws answers 503 `connection_unavailable`.
  - A Connection that returns a rejection answers 401 as `unauthorized` and any other code as `forbidden`.
  - A Connection seen earlier but absent now answers 503 and does not fall back to `guard`.
  - A host that never had one is decided by `guard`.

## Cross-repo consistency

- A consumer's `npm test` compares its embedded blocks byte for byte against the dock version it pins; versions are immutable and the pin is exact, so pin agreement is fragment agreement.
- After a fragment is added, a consumer re-runs all four `sync` scripts and raises its pin to the released version; until then `check` does not compare the new block.
- `dsh-plugin-parity` is a manual diagnostic and does not run in CI.
  - Blocks are compared after their common indentation is stripped. Four checks: the three host blocks are byte-identical and sit in dependency order; one exact dock pin; no private copy of an enforcement decision outside the blocks; the same allow/deny verdict in every member, with error codes and wording allowed to differ.
  - `--root <dir>`: the directory holding the repository checkouts.
  - `--member <repo>:<export>`: one participant and the guard factory it exports, repeated per participant; the tool presupposes no member.
  - `--fleet <repo>`: names the member that opts into fleet mode, so only its guard is checked for a bounded relaxation; a name outside the member list fails with a non-zero exit.
  - Without `--member`: static checks only, discovering every checkout that embeds the host guard block.
  - `--self-test`: checks the block extractor and the block dropping against inline samples, with no checkout needed.
- `dsh-plugin-docs` checks the bilingual documentation pairs, and each repository calls it from its `docs:check` script.
  - `--config <module>`: a module exporting an array of `{ name, zh, en, shape? }` decides which pairs are checked, where they live and how each is compared.
  - `shape` defaults to `markdown` and compares the heading-level sequence and the code-fence languages, with fence content exempt.
  - `shape: 'changelog'` compares the version sections (the `Unreleased` section included), the category sections and the item counts.
  - `--base <revision>`: both files of every pair must have changed since that revision, so a one-sided change is a missing translation.
  - An all-zero revision is the null OID, which leaves no previous state to compare, so that requirement is skipped with a note while the structure checks still run.

## Development and verification

Full check of this repository (the release procedure is in `docs/RELEASING.md`):

```sh
npm test
node bin/dsh-plugin-docs.js --config docs.config.mjs
for f in bin/*.js dist/*.js; do node --check "$f"; done
node bin/dsh-plugin-parity.js --self-test
npm pack --dry-run
```
