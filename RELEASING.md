# Releasing

1. Update the version and changelogs on `dev`.
2. Run `npm test`, syntax checks, and `npm pack --dry-run`.
3. Merge the release commit to `main` and tag it `vX.Y.Z`.
4. Push the tag. The publish workflow releases npm and GitHub artifacts.
