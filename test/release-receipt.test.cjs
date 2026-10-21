'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
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

// Invariant: first publication captures latest even when maintenance does not exist.
// Real npm + local HTTP registry are the system under test; only the registry boundary is synthetic.
// Negative control runs the old unversioned command against the same packument and must fail.
test('real npm captures tags before the first maintenance publication', async () => {
    const name = '@koralabs/kora-labs-contract-testing';
    const requests = [];
    const tags = { latest: '0.0.9' };
    const server = createServer((request, response) => {
        requests.push({ method: request.method, path: decodeURIComponent(request.url) });
        if (request.method !== 'GET' || decodeURIComponent(request.url) !== `/${name}`) {
            response.writeHead(404).end('{}');
            return;
        }
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
            name, 'dist-tags': tags,
            versions: { '0.0.7': { name, version: '0.0.7' }, '0.0.9': { name, version: '0.0.9' } }
        }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const registry = `http://127.0.0.1:${server.address().port}`;
    const temporaryRoot = resolve(__dirname, '../tmp');
    mkdirSync(temporaryRoot, { recursive: true });
    const dir = mkdtempSync(join(temporaryRoot, 'harness-registry-'));
    const config = join(dir, 'npmrc');
    writeFileSync(config, `@koralabs:registry=${registry}\n`);
    const env = { ...process.env, NPM_CONFIG_TAG: 'maintenance', NPM_CONFIG_USERCONFIG: config,
        NPM_CONFIG_CACHE: join(dir, 'cache'), NPM_CONFIG_UPDATE_NOTIFIER: 'false', NPM_CONFIG_FETCH_RETRIES: '0' };
    const run = (command, args) => new Promise((resolve, reject) => {
        const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => { child.kill(); reject(new Error('npm fixture request timed out')); }, 15_000);
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    });
    try {
        const negative = await run('npm', ['view', name, 'dist-tags', '--json', '--registry', registry]);
        assert.notEqual(negative.code, 0, 'old command must fail without a maintenance tag');
        assert.match(negative.stderr, /No match found for version maintenance/);
        const captured = await run(process.execPath, [resolve(__dirname, '../scripts/capture-release-tags.cjs'), registry]);
        assert.equal(captured.code, 0, captured.stderr);
        assert.deepEqual(JSON.parse(captured.stdout), { latest: '0.0.9' });
        assert.deepEqual(tags, { latest: '0.0.9' });
        assert(requests.length >= 2);
        assert(requests.every(r => r.method === 'GET' && r.path === `/${name}`));
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        rmSync(dir, { recursive: true, force: true });
    }
});
