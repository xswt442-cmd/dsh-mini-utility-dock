# Contributing

## Branches

Pull requests target `dev`. Maintainers fast-forward `main` before a release. Merging, tagging, and publishing are maintainer actions. CI runs on pull requests.

## Pull request descriptions

A description states the change, the work completed, and the checks actually run, in a Simplified Chinese section and a matching English section. Deferred work belongs in an issue.

## Documentation

`README.md` and `README.en.md` change together. `docs/CHANGELOG.md` and `docs/CHANGELOG.en.md` change together. `npm run docs:check` compares the pairs declared in `docs.config.mjs`. Tracked files contain no personal paths, credentials, private host details, or one-off logs.

## Fragments

`dist/` is the single source for the shared host and client fragments. The embedding CLI maintains the marked blocks in consumer files through its `sync` and `check` commands. A change to a fragment belongs in `dist/`, and the consumer pins rise in a separate release.

## Verification

Run these checks before opening a pull request:

```sh
npm test
node bin/dsh-plugin-docs.js --config docs.config.mjs
for f in bin/*.js dist/*.js; do node --check "$f"; done
node bin/dsh-plugin-parity.js --self-test
npm pack --dry-run
```

## Version history

Release notes are generated from the section for the tagged version in `docs/CHANGELOG.md`. `docs/RELEASING.md` records the maintainer release steps.

## Security reports

Security findings follow [SECURITY.md](SECURITY.md).
