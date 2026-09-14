# dsh-mini-utility-dock

Canonical fragments and an embedding CLI shared by the DSH plugins: the utility dock, plus the loopback predicate helpers. Both are embedded into consumer source at build time.

## Usage

Put the markers for the fragment you want into the target file, then run the CLI; the fragment is selected by the marker name.

### The utility dock fragment

Embedded into a plugin's `client.js`:

```js
  // <dsh-mini-utility-dock>
  // </dsh-mini-utility-dock>
```

```sh
npx dsh-mini-utility-dock sync path/to/client.js
npx dsh-mini-utility-dock check path/to/client.js
```

`sync` preserves the markers and their indentation; `check` exits non-zero when the content has drifted. The embedded script deduplicates itself through the page-local global protocol v1, so a plugin still runs standalone.

### The two host-side fragments

A plugin's `lib/shared.js` embeds **both** blocks, in this fixed order:

```js
  // <dsh-loopback-helpers>
  // </dsh-loopback-helpers>

  // <dsh-host-guard>
  // </dsh-host-guard>
```

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

**Which owns what.** `dsh-loopback-helpers` is what counts as loopback: it exports `LOOPBACK_HOSTNAMES`, `normalizeHostValue`, `hostHostname`, `isLoopbackName` and `isLoopbackAddress`, covering both the Host-header path and the TCP-peer path. `dsh-host-guard` is the policy: it exports `portOf`, `GUARD_REASONS` and `DEFAULT_GUARD_POLICY`, and provides a `bindGuard()` factory internally.

**Why two blocks, and why the order is fixed.** One is a stable fact about what an address is; the other is a policy about who may call an API. Merging them would let a policy change drag the predicates along with it. Because both land in one file, `dsh-host-guard` neither redeclares those predicates nor imports them — it uses the module-scope names the block above publishes. Redeclaring or importing both break (verified: a duplicate declaration is a hard `SyntaxError`). The CLI maintains **every** marked block in a file, in dependency order, so placing the guard block first is a real defect and the parity check fails on it.

**Why they are shared.** Three hand-maintained copies drifted three times — all rejecting IPv6 loopback; disagreeing on which Host spellings are loopback; and an unbracketed IPv6 Host silently skipping the allowlist in one plugin while the others denied it. Never edit between the markers: edit `dist/loopback.js` or `dist/guard.js` and re-`sync`. Cross-repo consistency is checked by each consumer's `scripts/guard-parity.mjs`, which compares both blocks byte for byte, checks that no repo hides a private implementation beside them, and asserts that all three reach the same answer for every decision.

`bindGuard` is deliberately **not** exported: a consumer embeds this block into the same file as its own exports, so exporting that name would collide. Each plugin calls `bindGuard()` and passes its own error codes and wording as `policy` — the enforcement is shared, the vocabulary stays each plugin's own.

You can also embed from this repo's own script (it never hard-codes a consumer path; the target is passed by the caller):

```sh
npm run dock:embed -- check path/to/client.js  # verify only, non-zero on drift
npm run dock:embed -- sync path/to/client.js   # write between the markers
```

Consumers also expose `loopback:sync` / `guard:sync` (same meaning, target fixed to their own `lib/shared.js`); either one maintains both blocks in the file.

When registering, a missing, blank, or non-string `label` falls back to `id` as the accessible name, avoiding `aria-label="undefined"`.
