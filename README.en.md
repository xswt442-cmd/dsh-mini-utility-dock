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
| utility launcher | `dsh-utility-launcher` | `lib/client.js` | `registerUtilityLauncher`, `UTILITY_ITEM_SLOT` |

## Usage

Write the markers into the target file, then run the CLI.

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

The CLI maintains every marked fragment in the file, applied bottom-up in `FRAGMENTS` order. `sync` preserves marker indentation; `check` exits non-zero on drift.

Equivalent entry point from this repository (target passed by the caller):

```sh
npm run dock:embed -- check path/to/shared.js
npm run dock:embed -- sync path/to/shared.js
```

Consumers invoke the same CLI as `loopback:sync` / `guard:sync` with the target fixed to their own `lib/shared.js`, and as `launcher:sync` for the `dsh-utility-launcher` block in their own `lib/client.js`.

## Constraints

- `dist/` is the single source. Run `npm test` after a change, and re-`sync` consumers.
- The two fragments in `lib/shared.js` have a fixed order, `dsh-loopback-helpers` first: `dsh-host-guard` uses the module-scope names the preceding fragment exports, and neither redeclares nor imports them.
- A fragment must not contain `import` or `require`; a consumer must publish standalone.
- `bindGuard` is not exported — a consumer declares its own guard export in the same file. Each plugin passes its own error codes and wording through `policy`; the enforcement is shared.

## Cross-repo consistency

A consumer's `npm test` runs `loopback:check` / `guard:check`, comparing its two fragments byte for byte against the dock version it pins. A published version is immutable and consumers pin an exact version, so pin agreement implies fragment agreement.

`dsh-plugin-parity` (a bin provided by this package) checks that cross-repo property directly, including pin agreement and a behavioral comparison. It is a manual diagnostic and **does not run in CI**: the property cannot hold while peers sit on a different branch. The member list is caller-supplied via `--member <repo>:<export>` — the guard factory's export name is per-repository by fragment design, so the tool presupposes no members; without `--member` it runs the static checks only and discovers every checkout that embeds the guard block.

`dsh-plugin-docs` (another bin of this package) checks the documentation pairs for structural alignment: the two READMEs share heading levels and code-fence languages, the two CHANGELOGs expose the same releases, sections and item counts (section titles normalized through a bilingual category map); `--base <revision>` additionally requires both files of a pair to change together — a one-sided edit is a missing translation. Repositories opt in by pointing their own `docs:check` script at it; this package runs the same check on its own bilingual docs.
