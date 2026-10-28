# @koralabs/helios 0.16.8-2 provenance

`package.json` depends on `@koralabs/helios` `0.16.8-2`. `yarn.lock` has pinned it since commit `964da4d` (2024-07-09) with integrity
`sha512-qAKs3PgZye+vjWM9bZVgqVVJgA3CruVeDoFn6xAoH3us7seofSei3N1364bKTsYHTz+hEtMRcYU4GEtceaJs1A==`.

## Where it came from

- The package was built with `deploy.sh` in [koralabs/helios](https://github.com/koralabs/helios) (branch `0.16.8`). The script copies `helios.js`, `helios.d.ts`, `helios-internal.d.ts`, `LICENSE`, `README.md` and `package.json`. It renames the package to `@koralabs/helios`, sets `version` to `$VERSION`, rewrites the `// Version:` banner in `helios.js`, then runs `npm publish --access public --ignore-scripts` to registry.npmjs.org. It was published by hand; there is no workflow.
- The whole `@koralabs/helios` package has since been deleted from npmjs (`GET /@koralabs%2fhelios` returns 404). GitHub Packages only ever had `0.16.8-1`. No copy of the archive was found in git tags, GitHub Packages, local Yarn/npm caches or `node_modules` on the workstation, the AI box, SFO or RDM.
- `npm pack` output is byte-deterministic (fixed mtimes, sorted entries). Rebuilding `0.16.8-1` from helios `847bf03` this way produces the GitHub Packages archive byte for byte (sha512 `/pbL4l…`) with npm 9.8.1 through 11.19.0. That validates the method.
- Doing the same with `VERSION=0.16.8-2` for every helios commit from 2024 produced **exactly one** match: commit [`13aa1eb`](https://github.com/koralabs/helios/commit/13aa1eb24ba78caee786681c8b1ffe143d43ce86) ("Adding Kora workarounds", committed 2024-08-07). Its sha512 equals the locked integrity. The archive was published on or before 2024-07-09 from that tree while it was still uncommitted; the commit was made later.

## How this repo uses it

- `vendor/koralabs-helios-0.16.8-2.tgz` is the rebuilt archive. `scripts/reproduce-helios-0.16.8-2.sh` rebuilds it from `13aa1eb` and fails unless the sha512 matches.
- In `yarn.lock` only the `resolved` field changed, to that file. The original `integrity` is kept, and Yarn checks it on install (a different archive fails with `Integrity check failed`). The declared dependency in `package.json` is unchanged.
- `test/locked-compiler.test.mjs` checks the archive against the locked sha512/sha1 and checks that the installed `helios.js` is byte-identical to it.

## Still open

- **Consumers:** published `0.0.8` and `0.0.9` declare `@koralabs/helios@0.16.8-2`, which no registry serves, so consumers cannot install them. To fix that, publish this exact archive (same sha512) to GitHub Packages next to `0.16.8-1`. That is a release decision and has not been done.
- **The shared `npm-publish` deploy path** runs plain `npm install`, which ignores `yarn.lock`. It would still 404 until the archive is published. The `deploy.yml` workflow is currently disabled.
