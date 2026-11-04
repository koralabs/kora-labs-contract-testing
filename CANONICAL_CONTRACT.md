# kora-labs-contract-testing canonical contract

The legacy harness that runs Helios smart-contract validators against fake transactions and reports approve/deny results. It holds no keys and moves no money; a wrong "pass" here can make a broken validator look safe.

1. The compiler is exactly `@koralabs/helios` 0.16.8-2, byte for byte: the lockfile keeps the original sha512 integrity and the installed `helios.js` equals the vendored archive's. No other compiler build may stand in.
2. A test succeeds only when the validator's actual result matches the expectation (an APPROVE test must approve, a DENY test must deny). A throw while building the transaction is never a pass, and every failed test increments `failCount`.
3. Offline evaluation is not node execution: a pass here is not proof a contract is safe on chain.
