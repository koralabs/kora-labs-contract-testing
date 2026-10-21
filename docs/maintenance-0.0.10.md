# Proposed 0.0.10 compatibility maintenance release

Status: review candidate only. Do not merge or publish until the exact release path/head is reviewed. This does not repair or accept current master’s unavailable Helios 0.16.8-2 dependency.

## Source and compiler boundary

This candidate is rooted at the actually published harness 0.0.7 source commit `dac959e00a3deecbf40a3803210456f1e7b9b944`, not current master 0.0.9. Proposed immutable version: **0.0.10** (0.0.8 and 0.0.9 already exist). It retains the original exact compiler dependency `@koralabs/helios: 0.16.8-1`. Do not silently merge this maintenance graph into current master or label it recovery of -2. Review/adopt the compatibility maintenance line explicitly, then publish through GitHub Actions; the consumer owner updates CIP only after independently verifying the new archive.

Compiler archive: `https://npm.pkg.github.com/download/@koralabs/helios/0.16.8-1/69a0f2c75a14e37d221a62457208ae0f09f628d8`, SHA512 `sha512-/pbL4lUP7CBELSxfMuZUhJ5rZ5B3T+kwaQ4joI9y+SDMFyfqySARcgv5+uTT1nnTd/gCgM3QzMUZBOL8BMM3AA==`, registry gitHead `93dbfc6822b76a6c0dde3a9003ac069a6f7e4303`. This is the consumer’s existing compiler identity; no mixed Helios classes or replacement compiler is intended. The only lock changes from 0.0.7 are authenticated-registry distribution URLs for the original compiler and common 4.0.22, each byte-verified against the original integrity; versions/integrities and all other graph metadata are retained.

## Root correction

- What failed: mint-only public-key inputs rejected a redeemer, and script inputs before public-key inputs missed their required redeemer.
- Why: Test.build selected the spending redeemer by last input position, even though the same fixture redeemer can be a minting redeemer.
- Enabling condition: fixtures expose real inputs with different locking credentials, while the generic harness assumed the last input was script-locked.
- Correction: choose spending redeemers by each input’s actual validator credential; mintTokens is unchanged. Required-redeemer rejection remains the real Tx API’s responsibility. This is a source root-cause fix, not fixture reordering, an evaluator mock, or a consumer/node_modules patch.

`test/contractTester.test.mjs` exercises the built source with real compiler and transaction objects: mint-only, both input orders for spending, public-key-only without a redeemer, and missing-required-script-redeemer rejection. Minimal test-only programs do not modify any deployed validator. The original positional source fails two cases and passes two; corrected source passes all four. The original publication is independently also the consumer’s two-fail/two-pass negative control. CI installs the frozen original dependency graph and builds/tests the actual candidate; no browser/e2e or live-chain operations.

## Missing -2 recovery investigation (package-owner observations)

Required -2 SHA512: `sha512-qAKs3PgZye+vjWM9bZVgqVVJgA3CruVeDoFn6xAoH3us7seofSei3N1364bKTsYHTz+hEtMRcYU4GEtceaJs1A==`.

On 2026-10-21, authenticated registry metadata listed only -1. The existing logged-in package administrator’s versions page (`https://github.com/orgs/koralabs/packages/npm/helios/versions`) showed **one active, zero deleted** versions. Searches of workstation/ai-box/SFO/RDM Yarn and exact SHA512 npm-cache locations found no -2 artifact. Existing source history/cache investigation also found no -2 provenance. R2 bucket-root enumeration found no package-archive bucket; `kora-backups` contains only `sfo/sign.koralabs.io/`, and `kora-deploy-artifacts` contains application build prefixes, not a compiler archive collection. Signing backups were not opened. These are scoped negative findings, not proof no historical copy can exist anywhere. No -2 was recovered, recreated, relabeled, checksum-replaced or replaced with -1 in current master.

## Acceptance and release gates

1. Review exact source diff/head and this explicit 0.0.7 maintenance path; leave current master’s -2 gap explicit.
2. Green frozen-install/source-build/regression CI for the reviewed head. Compatibility proof against -1 is not acceptance of -2.
3. Publish a new immutable 0.0.10 through the reviewed Actions release path, never overwrite 0.0.7 or modify validator/settings code. Verify metadata gitHead, dependencies and downloaded archive SHA512 before sending the receipt.
4. Consumer owner intentionally updates the locked package/version only after that receipt, keeping a single unchanged -1 compiler identity, then runs all five HTTP-boundary tests, four harness regressions and ten unchanged contract approval/denial cases. Those consumer acceptance results are not claimed by the package source tests.
