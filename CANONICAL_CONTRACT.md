# Canonical contract: kora-labs-contract-testing

## Purpose and authority

I am the legacy test harness that runs Helios smart-contract validators against fake transactions and reports approve/deny results. I hold no keys and move no money. But Handle contracts are judged with me, so a wrong "pass" from me can let a broken validator look safe. Edits to the contract-defining files listed in [`.enclave`](./.enclave) need operator approval before they merge. A green harness run is not proof a contract is safe on chain.

## Invariants

1. **The compiler is exactly `@koralabs/helios` 0.16.8-2, byte for byte.** `yarn.lock` keeps the original sha512 integrity; the vendored archive satisfies it; the installed `helios.js` equals the archive's. No other compiler build may stand in. Enforced by `test/locked-compiler.test.mjs`.
2. **A test counts as success only when the validator's actual result matches the expectation** (APPROVE test must approve, DENY test must deny). A throw while building the transaction is never a pass. A failed test increments `failCount`. Enforced in part by `test/contractTester.test.mjs`.
3. **Publishing happens only through the reviewed workflow**, which never runs without an explicit reviewed commit. A release is an operator decision.
4. **No secrets or real wallets in the repo.** Fixtures use fake addresses and generated UTxO ids only.

## Boundaries and known limits

- Offline Helios evaluation is not node execution; passing here does not authorize mint, settings or validator changes.
- Invariant 4 and the "reviewed commit only" part of invariant 3 have no test.
- The repo has no lint and no suite beyond the three files in `test/`; `npm test` is a stub.
- The pinned archive is not on any registry, so consumers cannot install published 0.0.8/0.0.9 (see `docs/helios-0.16.8-2-provenance.md`).

## Refactors needed to enforce this

- Add a test that an APPROVE expectation fails when the validator denies, and the reverse, if `contractTester.test.mjs` does not already cover both directions.
- Publish the pinned archive to GitHub Packages so the lock is installable.
- Add a secret-scan check for invariant 4.
- Make `npm test` run the `test/` files instead of echoing.
