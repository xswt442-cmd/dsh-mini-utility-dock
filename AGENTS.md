# dsh-mini-utility-dock

This repository contains the canonical DSH utility dock classic-script fragment and its embedding CLI.

## Engineering

- Keep `dist/bootstrap.js` self-contained: no imports, exports, or runtime package dependencies.
- The protocol is page-local `createhelper.dsh.utility-dock` version 1.
- This repo is the source of the fragments the consumer plugins embed. `sync` / `check` maintain every marked block in the target file, bottom-up in `FRAGMENTS` order, so a consumer keeps exactly one synced copy.

## Verify

```sh
npm test
```
