# dsh-mini-utility-dock

Source fragments and an embedding CLI shared by the DSH plugins. Fragments are written into a consumer at build time, so a plugin publishes standalone with no dependency on this package.

## Fragments

Three fragments, each delimited by markers.

| Fragment | Marker | Target file | Exports |
| --- | --- | --- | --- |
| dock bootstrap | `dsh-mini-utility-dock` | `lib/client.js` | — |
| loopback predicates | `dsh-loopback-helpers` | `lib/shared.js` | `LOOPBACK_HOSTNAMES`, `normalizeHostValue`, `hostHostname`, `isLoopbackName`, `isLoopbackAddress` |
| host request guard | `dsh-host-guard` | `lib/shared.js` | `portOf`, `GUARD_REASONS`, `DEFAULT_GUARD_POLICY` |

`dsh-loopback-helpers` decides address locality; the Host-header path and the TCP-peer path share one decision. `dsh-host-guard` decides admission, and provides a `bindGuard()` factory internally.

## Usage

Write the markers into the target file, then run the CLI.

```sh
npx dsh-mini-utility-dock sync path/to/client.js
npx dsh-mini-utility-dock check path/to/client.js
```

`sync` preserves the markers and their indentation and writes the fragment; `check` exits non-zero when the content no longer matches it. The CLI maintains every marked fragment in the target file, applied bottom-up in `FRAGMENTS` order. A file containing a single fragment is unaffected.

This repository also exposes an equivalent entry point, with the target path passed by the caller:

```sh
npm run dock:embed -- check path/to/client.js  # verify only, non-zero on drift
npm run dock:embed -- sync path/to/client.js   # write between the markers
```

Consumers invoke the same CLI as `loopback:sync` / `guard:sync`, with the target fixed to their own `lib/shared.js`; either command maintains both fragments in that file.

## The two host-side fragments

The two fragments in `lib/shared.js` have a fixed order, `dsh-loopback-helpers` first.

The order is a functional requirement, not a style choice. Both fragments occupy one file, and `dsh-host-guard` uses the module-scope names the preceding fragment exports. It therefore neither redeclares those predicates nor imports a sibling module: redeclaring collides with the declaration in the same file, and importing would break the standalone-publication constraint. The `guard-parity` check fails when the order is reversed.

`bindGuard` is not exported from the fragment. A consumer declares its own guard export in the same file (typically reusing an existing name such as `createGuard`), and exporting the same identifier would collide. Each plugin calls `bindGuard()` and passes its own error codes and wording through `policy`: the enforcement is shared, the error vocabulary stays with each plugin.

## Development

`dist/` is the single source for each fragment. Run `npm test` after a change; consumers that have already embedded a fragment must re-run the matching `sync` command.

A fragment must not contain `import` or `require`: it shares a file with the consumer's own code, and the consumer must publish standalone. Tests assert this constraint.

## Registration

A missing, blank, or non-string `label` falls back to `id`, so no item renders `aria-label="undefined"`.
