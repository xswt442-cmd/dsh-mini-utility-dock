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

### The host guard fragment

Embedded into a plugin's `lib/shared.js`:

```js
  // <dsh-host-guard>
  // </dsh-host-guard>
```

```sh
npx dsh-mini-utility-dock sync path/to/shared.js
npx dsh-mini-utility-dock check path/to/shared.js
```

The fragment exports `LOOPBACK_HOSTNAMES`, `normalizeHostValue`, `hostHostname`, `portOf`, `isLoopbackName`, `isLoopbackAddress`, `GUARD_REASONS` and `DEFAULT_GUARD_POLICY`, and provides a `bindGuard()` factory internally. It is the single source of truth for what counts as loopback and for how a same-origin request is judged, on both the Host-header path and the TCP-peer path.

`bindGuard` is deliberately **not** exported: a consumer embeds this block into the same file as its own exports, so exporting that name would collide. Each plugin calls `bindGuard()` and passes its own error codes and wording as `policy` — the enforcement is shared, the vocabulary stays each plugin's own. Three hand-maintained copies drifted three times — all rejecting IPv6 loopback; disagreeing on which Host spellings are loopback; and an unbracketed IPv6 Host silently skipping the allowlist in one plugin while the others denied it — so sharing plus generation removes that whole class of defect: never edit between the markers, edit `dist/guard.js` and re-`sync`. Cross-repo consistency is checked by each consumer's `scripts/guard-parity.mjs`, which compares the generated block byte for byte and asserts that all three reach the same answer for every decision.

You can also embed from this repo's own script (it never hard-codes a consumer path; the target is passed by the caller):

```sh
npm run dock:embed -- check path/to/client.js  # verify only, non-zero on drift
npm run dock:embed -- sync path/to/client.js   # write between the markers
```

Consumers also expose `guard:sync` / `guard:check`, which mean the same thing with the target fixed to their own `lib/shared.js`.

When registering, a missing, blank, or non-string `label` falls back to `id` as the accessible name, avoiding `aria-label="undefined"`.
