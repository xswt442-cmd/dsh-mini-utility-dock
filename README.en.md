# dsh-mini-utility-dock

The shared DSH utility dock package. It provides a canonical, self-contained classic-script fragment and a build-time CLI for embedding it into a plugin `client.js`.

Put these markers in the client file:

```js
  // <dsh-mini-utility-dock>
  // </dsh-mini-utility-dock>
```

Run `npx dsh-mini-utility-dock sync path/to/client.js` to embed the current fragment, or `... check ...` in CI. Marker indentation is preserved. The fragment deduplicates itself through the page-local global protocol v1.
