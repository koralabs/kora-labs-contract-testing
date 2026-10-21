'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { verifyReceipt } = require('../scripts/release-receipt.cjs');

function receipt() {
    return { before: { latest: '0.0.9' }, after: { latest: '0.0.9', maintenance: '0.0.10' },
        metadata: { name: '@koralabs/kora-labs-contract-testing', version: '0.0.10', gitHead: 'a'.repeat(40),
            dependencies: { '@koralabs/helios': '0.16.8-1' }, dist: { integrity: 'sha512-exact', shasum: 'exact' } },
        sourceHead: 'a'.repeat(40) + '\n', pack: { integrity: 'sha512-exact', shasum: 'exact' } };
}

// User-visible invariant: maintenance publication keeps latest unchanged and proves artifact/source/compiler identity.
// Removing any corresponding comparison makes its negative case below stop throwing.
test('accepts the tested immutable archive and unchanged latest', () => {
    assert.doesNotThrow(() => verifyReceipt(receipt()));
    const noLatest = receipt();
    delete noLatest.before.latest;
    delete noLatest.after.latest;
    assert.doesNotThrow(() => verifyReceipt(noLatest));
});

test('rejects changed tags, wrong package/source/compiler, or different archive bytes', () => {
    for (const corrupt of [
        r => { r.after.latest = '0.0.10'; },
        r => { r.after.maintenance = '0.0.9'; },
        r => { r.metadata.name = 'other'; },
        r => { r.metadata.version = '0.0.9'; },
        r => { r.metadata.gitHead = 'b'.repeat(40); },
        r => { r.metadata.dependencies['@koralabs/helios'] = '0.16.8-2'; },
        r => { r.metadata.dist.integrity = 'sha512-different'; },
        r => { r.metadata.dist.shasum = 'different'; }
    ]) {
        const changed = receipt();
        corrupt(changed);
        assert.throws(() => verifyReceipt(changed));
    }
});

// Exercise the actual npm subprocess, not a mock or an assertion about YAML text.
// Dropping the standard environment config makes npm report its default latest instead.
test('npm subprocess inherits the maintenance tag configuration', () => {
    const tag = execFileSync('npm', ['config', 'get', 'tag'], {
        encoding: 'utf8', env: { ...process.env, NPM_CONFIG_TAG: 'maintenance' }
    }).trim();
    assert.equal(tag, 'maintenance');
});
