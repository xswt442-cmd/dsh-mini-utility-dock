# Releasing

Releases are tag-driven. Develop and verify on `dev`, merge into `main`, and let
`publish.yml` do the publishing: a `vX.Y.Z` tag triggers it, it re-runs every
check, publishes to npm through Trusted Publishing (OIDC — no npm token exists in
this repository), and opens the GitHub release from the changelog. There is
nothing to publish by hand.

Publishing this package is not a local act: every byte of `dist/` is embedded text
in somebody else's repository, so a release creates obligations for the plugins
that embed it. Read the whole list before you push a tag.

## Checklist

1. On `dev`, choose `X.Y.Z` and update:
   - `package.json#version` — the only version this package declares. A plugin
     keeps a second copy in `lib/shared.js#VERSION`; there is no such file here,
     because this package ships fragments rather than a plugin.
   - `package-lock.json` with `npm install --package-lock-only`, so its recorded
     version does not drift from the manifest.
   - Both changelogs: replace `## Unreleased` with `## X.Y.Z - YYYY-MM-DD` in
     `CHANGELOG.md` and `CHANGELOG.en.md`, keeping the same sections, the same
     number of bullets and the same order. That version section becomes
     the GitHub release notes verbatim (`scripts/release-notes.mjs`), so its
     reader is someone installing this package, not its historian.
   - `README.md` / `README.en.md`, if a fragment, a marker or a script changed.
2. Run every check the workflow will run — the same commands this repository's
   `AGENTS.md` states under Verify:

   ```sh
   npm test
   node bin/dsh-plugin-docs.js
   for f in bin/*.js dist/*.js; do node --check "$f"; done
   node bin/dsh-plugin-parity.js --self-test
   npm pack --dry-run
   ```

   `npm pack --dry-run` is the one that catches a fragment left out of `files`: a
   published package missing a `dist/` file breaks every consumer's `sync`.
3. Commit and push `dev`, then merge it into `main` with a merge commit:

   ```sh
   git switch main
   git merge dev -m "merge: dev -> main"
   git push origin main
   ```

4. Tag the release commit **on `main`** and push only that tag:

   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

## The tag has to be on main

The `checks` job refuses a tag that is not an ancestor of `origin/main`, and it
refuses one whose version does not match `package.json`. That is why step 3 merges
with a merge commit: a squash or a rebase merge replays the release commit onto
`main` as a different object, so a tag made before or during it points at a commit
that is no longer on any branch, and the workflow will not publish it. Do not work
around the gate — tag the commit `main` actually has.

## What the workflow is allowed to touch

`publish.yml` is three jobs, and the permissions are the point of the split:

- `checks` — `contents: read`. Everything that executes this repository's code
  lives here: the tag/version match, the tag's ancestry in `main`, and the command
  list from step 2 above. `GITHUB_TOKEN` is exported into every step of a job, so
  a job that runs `npm test` must not be able to write to the repository.
- `npm` — `contents: read` plus `id-token: write`. The second grant is the OIDC
  exchange npm Trusted Publishing uses; no npm token, automation token or `.npmrc`
  credential lives in this repository's settings, and none should be added. A
  version already on npm is skipped.
- `release` — the only job with `contents: write`, and the only one that does not
  run the code under test: it reads one changelog section and calls `gh`. It
  requires `checks` to have passed and merely waits for `npm`, so a version
  published out of band still gets its release notes and a registry hiccup does not
  take them down. An existing release has its notes refreshed rather than failing
  over an occupied name.

## After the tag: the consumers owe a re-sync

Anything in `dist/` that changed bytes obligates every plugin that embeds that
block. In each of those repositories:

1. Run the four sync scripts — `loopback:sync`, `guard:sync`, `http:sync`,
   `launcher:sync` — so every marked block is rewritten from the new dock.
2. Raise `devDependencies['dsh-mini-utility-dock']` to `X.Y.Z` in the same commit,
   and keep all four blocks and that one pin moving together.
3. Re-run its `npm test`, which now compares the embedded blocks against the new
   version.

Until a consumer raises its pin, its `http:check` passes vacuously over a new
block: `check` selects blocks from the markers the pinned CLI knows, so an older
dock reports ok for the two host blocks it recognizes and never looks at
`dsh-host-http` at all. Only that repository's own test that counts marker pairs
notices a missing or duplicated block, which is why the pin cannot be left behind.

When the release only touches fragment comments, say so in the release notes: the
consumers still have to re-sync and re-pin, and they should not have to read a
diff to find out that nothing behavioral moved.

## One-time setup: the Trusted Publishing binding

npm's Trusted Publishing relationship is configured on npmjs.com for this package
and is bound to this repository and to the workflow file
`.github/workflows/publish.yml`. npm can only record that relationship for a
package name it already knows, so if this repository ever needs a release the
workflow cannot make — the first one under a new name, or one after the binding was
lost — publish that single version once from a logged-in account
(`npm publish --provenance --access public`) and every later release goes back
through the workflow. Renaming the package, the repository or its owner, or moving
and renaming that workflow file breaks the binding, and the fix is the same one-off
manual publish.

## Published versions are immutable

A version already on npm cannot be edited or un-published, only deprecated. If a
release is wrong, deprecate it and ship a patch; never move or delete a tag to
make the workflow retry, because the bad tarball stays live and the tag now points
somewhere the release notes do not describe.

```sh
npm deprecate "dsh-mini-utility-dock@X.Y.Z" <reason>
```
