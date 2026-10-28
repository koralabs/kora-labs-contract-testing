import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';

// Integrity recorded for @koralabs/helios@0.16.8-2 when it was locked on 2024-07-09
// (commit 964da4d), before the npm package was deleted.
const ORIGINAL_INTEGRITY = 'sha512-qAKs3PgZye+vjWM9bZVgqVVJgA3CruVeDoFn6xAoH3us7seofSei3N1364bKTsYHTz+hEtMRcYU4GEtceaJs1A==';
const root = new URL('../', import.meta.url);
const archive = readFileSync(new URL('vendor/koralabs-helios-0.16.8-2.tgz', root));

function lockEntry() {
    const lock = readFileSync(new URL('yarn.lock', root), 'utf8');
    const match = lock.match(/^"@koralabs\/helios@0\.16\.8-2":\n((?: {2}.*\n)+)/m);
    assert(match, 'yarn.lock has no @koralabs/helios@0.16.8-2 entry');
    return Object.fromEntries(match[1].trim().split('\n').map(l => l.trim().match(/^(\S+) "?([^"]*)"?$/).slice(1)));
}

// Reads one file out of an npm tarball (ustar, gzip) without extracting to disk.
function tarFile(tgz, name) {
    const tar = gunzipSync(tgz);
    for (let off = 0; off + 512 <= tar.length;) {
        const path = tar.subarray(off, off + 100).toString().replace(/\0.*$/s, '');
        if (!path) break;
        const size = parseInt(tar.subarray(off + 124, off + 136).toString().replace(/\0.*$/s, '').trim(), 8);
        if (path === name) return tar.subarray(off + 512, off + 512 + size);
        off += 512 + Math.ceil(size / 512) * 512;
    }
    throw new Error(`${name} not in archive`);
}

// Invariant: the lock still pins the original 0.16.8-2 integrity, and the vendored bytes satisfy it.
// Negative control: replacing the vendored archive with any other build (e.g. 0.16.8-1) changes both digests.
test('vendored archive matches the original locked sha512 and the resolved sha1', () => {
    const entry = lockEntry();
    assert.equal(entry.version, '0.16.8-2');
    assert.equal(entry.integrity, ORIGINAL_INTEGRITY);
    const [path, sha1] = entry.resolved.split('#');
    assert.equal(path, 'file:./vendor/koralabs-helios-0.16.8-2.tgz');
    assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, ORIGINAL_INTEGRITY);
    assert.equal(createHash('sha1').update(archive).digest('hex'), sha1);
});

// Invariant: the compiler the harness imports is exactly the locked archive, not a cached or substituted build.
// Negative control: installing any other helios build makes the byte comparison fail.
test('installed compiler is byte-identical to the vendored 0.16.8-2 archive', () => {
    const manifest = JSON.parse(tarFile(archive, 'package/package.json'));
    assert.equal(manifest.name, '@koralabs/helios');
    assert.equal(manifest.version, '0.16.8-2');
    const installed = readFileSync(new URL('node_modules/@koralabs/helios/helios.js', root));
    assert(installed.equals(tarFile(archive, 'package/helios.js')));
    assert.match(installed.subarray(0, 1024).toString(), /\/\/ Version: +0\.16\.8-2\n/);
});
