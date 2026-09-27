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

Consumers invoke the same CLI as `loopback:sync` / `guard:sync` / `http:sync` with the target fixed to their own `lib/shared.js`, and as `launcher:sync` for the `dsh-utility-launcher` block in their own `lib/client.js`. One command handles the three host-half blocks together: a block is selected by the marker that exists in the file, so `http:sync` and `loopback:sync` write different blocks of the same file.

## Constraints

- `dist/` is the single source. After changing a fragment, run the whole set below under "Development and verification", and have consumers re-`sync`.
- The three fragments in `lib/shared.js` have fixed positions: `dsh-loopback-helpers` → `dsh-host-guard` → `dsh-host-http`. The guard uses the module-scope names the preceding fragment exports, and neither redeclares nor imports them; `dsh-host-http` reads nothing from the two blocks above it and declares none of their names, so it can be embedded alone. Those positions are the `FRAGMENTS` order, and `sync` replaces blocks from the bottom of the file up; a file whose marker ranges overlap is rejected outright and left unwritten.
- `dsh-utility-launcher` lands in the client half: exactly one copy of the assembly runs per page (the first to load wins the `window` mutex and declares the menu seat), and every other copy contributes one row to that seat. That is a runtime fact, not a styling choice.
- A fragment must not contain `import` or `require`; a consumer must publish standalone.
- `bindGuard` is not exported — a consumer declares its own guard export in the same file. Each plugin passes its own error codes and wording through `policy`; the enforcement is shared.
- `createRequirePost({ respond, policy })` works the same way: the default code is `method`, and a repository's published vocabulary — `need_post`, Chinese wording, the `action` echoed back — is an override of `policy.method_not_allowed`, not a behavior difference. An unknown key throws.
- `createBrowserAuthorizer({ getConnection, getConnectionSeen, guard, respond })` takes accessors, not values: a host half's Connection is reassigned to `null` by a service reload, and the value-shaped version would keep admitting requests through a destroyed Connection. The semantics are fixed: a Connection that throws answers 503 `connection_unavailable`; a rejection is answered with its own code (401 → `unauthorized`, anything else → `forbidden`); a Connection that was seen but is absent now answers 503 and never falls back to the weaker guard; a host that never had one is decided by `guard`.

## Cross-repo consistency

A consumer's `npm test` runs `loopback:check` / `guard:check` / `http:check`, comparing the three blocks in its own `lib/shared.js` byte for byte against the dock version it pins. A published version is immutable and consumers pin an exact version, so pin agreement implies fragment agreement. The converse does not hold: `check` selects blocks by the markers it recognizes, so a consumer that has not raised its pin never looks at a block the older CLI does not know and that one check passes vacuously. After a fragment is added, a consumer re-runs all four `sync` scripts and raises its pin to the released version in the same commit.

`dsh-plugin-parity` (a bin provided by this package) checks that cross-repo property directly: every host block compared in isolation after stripping the block's common indentation (the three, `dsh-host-http` included), pin agreement, block position, and a behavioral comparison. It is a manual diagnostic and **does not run in CI**: the property cannot hold while peers sit on a different branch. The member list is caller-supplied via `--member <repo>:<export>` — the guard factory's export name is per-repository by fragment design, so the tool presupposes no members; `--fleet <repo>` names the single member that opts into fleet mode, and only its guard is checked for "the relaxation stays bounded", while naming a repository that is not a member fails with a non-zero exit; without `--member` it runs the static checks only and discovers every checkout that embeds the guard block. `--self-test` needs no checkout at all: it exercises the block extractor and the block-dropping step against inline samples, so run it first whenever either changes.

`dsh-plugin-docs` (another bin of this package) checks the documentation pairs for structural alignment: the two READMEs share heading levels and code-fence languages, the two CHANGELOGs expose the same releases — the `Unreleased` section included — with sections and item counts (section titles normalized through a bilingual category map); `--base <revision>` additionally requires both files of a pair to change together — a one-sided edit is a missing translation. When that revision is the all-zero null OID — which is what `github.event.before` carries for a newly created or force-pushed branch — there is no previous state to compare, so that one requirement is skipped with a note while the structural checks still run. Repositories opt in by pointing their own `docs:check` script at it; this package runs the same check on its own bilingual docs.

## Development and verification

`dist/` is the source, so one change has to pass three layers: fragment behavior, the CLI, and the documentation pair. This is the full check of this repository (identical to the Verify block in `AGENTS.md`; the release procedure is in `RELEASING.md`):

```sh
npm test
node bin/dsh-plugin-docs.js
for f in bin/*.js dist/*.js; do node --check "$f"; done
node bin/dsh-plugin-parity.js --self-test
npm pack --dry-run
```
