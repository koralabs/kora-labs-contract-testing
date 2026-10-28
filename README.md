# kora-labs-contract-testing

## Local install and tests

Node 20 and Yarn 1.22: `yarn install --frozen-lockfile && yarn test`. Tests run locally only, not in Actions.

The Helios compiler (`@koralabs/helios@0.16.8-2`) is installed from `vendor/`. That archive is a byte-identical rebuild of the deleted npm release; see [its provenance](docs/helios-0.16.8-2-provenance.md).
