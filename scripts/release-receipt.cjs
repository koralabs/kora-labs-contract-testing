'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

function verifyReceipt({ before, after, metadata, pack, sourceHead }) {
    assert.equal(after.latest, before.latest, 'Publication must not change latest');
    assert.equal(after.maintenance, '0.0.10', 'maintenance must select 0.0.10');
    assert.equal(metadata.name, '@koralabs/kora-labs-contract-testing');
    assert.equal(metadata.version, '0.0.10');
    assert.equal(metadata.gitHead, sourceHead.trim(), 'Registry source head differs from tested source');
    assert.equal(metadata.dependencies['@koralabs/helios'], '0.16.8-1');
    assert.equal(metadata.dist.integrity, pack.integrity, 'Registry archive differs from tested archive');
    assert.equal(metadata.dist.shasum, pack.shasum);
}

module.exports = { verifyReceipt };
if (require.main === module) {
    const root = process.argv[2] || 'tmp/release';
    const read = name => JSON.parse(fs.readFileSync(`${root}/${name}.json`, 'utf8'));
    verifyReceipt({ before: read('tags-before'), after: read('tags-after'), metadata: read('metadata'),
        pack: read('pack')[0], sourceHead: fs.readFileSync(`${root}/source-head`, 'utf8') });
    console.log('Verified immutable maintenance archive, compiler/source identity and unchanged latest tag.');
}
