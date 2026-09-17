# dsh-mini-utility-dock

Source fragments and an embedding CLI shared by the DSH plugins.

## Fragments

| Fragment | Marker | Target file | Exports |
| --- | --- | --- | --- |
| dock bootstrap | `dsh-mini-utility-dock` | `lib/client.js` | — |
| loopback predicates | `dsh-loopback-helpers` | `lib/shared.js` | `LOOPBACK_HOSTNAMES`, `normalizeHostValue`, `hostHostname`, `isLoopbackName`, `isLoopbackAddress` |
| host request guard | `dsh-host-guard` | `lib/shared.js` | `portOf`, `GUARD_REASONS`, `DEFAULT_GUARD_POLICY` |

## Usage

Write the markers into the target file, then run the CLI.

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

The CLI maintains every marked fragment in the file, applied bottom-up in `FRAGMENTS` order. `sync` preserves marker indentation; `check` exits non-zero on drift.

Equivalent entry point from this repository (target passed by the caller):

```sh
npm run dock:embed -- check path/to/client.js
npm run dock:embed -- sync path/to/client.js
```

Consumers invoke the same CLI as `loopback:sync` / `guard:sync`, with the target fixed to their own `lib/shared.js`.

## Constraints

- `dist/` is the single source. Run `npm test` after a change, and re-`sync` consumers.
- The two fragments in `lib/shared.js` have a fixed order, `dsh-loopback-helpers` first: `dsh-host-guard` uses the module-scope names the preceding fragment exports, and neither redeclares nor imports them.
- A fragment must not contain `import` or `require`; a consumer must publish standalone.
- `bindGuard` is not exported — a consumer declares its own guard export in the same file. Each plugin passes its own error codes and wording through `policy`; the enforcement is shared.
- A missing, blank, or non-string `label` falls back to `id`.

## Cross-repo consistency

A consumer's `npm test` runs `loopback:check` / `guard:check`, comparing its two fragments byte for byte against the dock version it pins. A published version is immutable and consumers pin an exact version, so pin agreement implies fragment agreement.

`scripts/guard-parity.mjs` (in each consumer) checks that cross-repo property directly, including pin agreement. It is a manual diagnostic and **does not run in CI**: the property cannot hold while peers sit on a different branch. Run it when all three checkouts share a branch.
