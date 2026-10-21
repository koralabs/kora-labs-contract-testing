#!/usr/bin/env node
'use strict';
const { execFileSync } = require('node:child_process');

// npm view otherwise selects NPM_CONFIG_TAG, which is deliberately maintenance during
// publication. Pin a known existing version so first publication can capture a packument
// that has latest but no maintenance tag yet. dist-tags still returns the full tag map.
const registry = process.argv[2] || 'https://npm.pkg.github.com';
process.stdout.write(execFileSync('npm', [
    'view', '@koralabs/kora-labs-contract-testing@0.0.7', 'dist-tags', '--json', '--registry', registry
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
