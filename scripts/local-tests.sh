#!/usr/bin/env bash
# Local test run recorded by adahandle-deployments/common/test-evidence.sh (replaces the old Actions tests).
set -euo pipefail
( set -e; yarn install --frozen-lockfile --non-interactive )
( set -e; yarn build )
( set -e; node --test test/release-receipt.test.cjs )
