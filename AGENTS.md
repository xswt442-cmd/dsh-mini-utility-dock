# dsh-mini-utility-dock

This repository contains the DSH plugin family's host- and client-side source fragments and their embedding CLI.

## Engineering

- This repo is the source of the fragments the consumer plugins embed. `sync` / `check` maintain every marked block in the target file, bottom-up in `FRAGMENTS` order, so a consumer keeps exactly one synced copy.
- `dsh-utility-launcher` (0.5.0) is the client-side assembly: one icon on the host's `shell.overlay` layer plus the menu it opens, with every consumer contributing one row to the child slot it declares. Do not reintroduce a page-local container — the layer, its click-through behaviour and the stacking order belong to the host.

## Verify

```sh
npm test
```
