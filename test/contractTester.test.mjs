import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import * as helios from '@koralabs/helios';
import { ContractTester, Test } from '../lib/contractTester.js';
import { Fixture, getAddressAtDerivation } from '../lib/fixtures.js';

// The harness fetches network parameters from this host during init. It no longer resolves,
// so only that exact GET is answered, with the locked compiler's own emulator parameters.
const PARAMS_URL = 'https://d1t0d7c2nekuk0.cloudfront.net/mainnet.json';

async function initTester() {
    const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
        assert.equal(String(url), PARAMS_URL);
        assert.equal(init?.method ?? 'GET', 'GET');
        return new Response(JSON.stringify(helios.rawNetworkEmulatorParams), { status: 200 });
    });
    try {
        const tester = new ContractTester(await getAddressAtDerivation(0));
        await tester.init();
        assert.equal(fetchMock.mock.callCount(), 1);
        return tester;
    } finally {
        fetchMock.mock.restore();
    }
}

const validator = body => helios.Program.new(`spending harness\nfunc main(_, redeemer: Int, _) -> Bool { ${body} }`);

function utxo(index, address, inlineDatum = false) {
    return new helios.TxInput(new helios.TxOutputId(`${'00'.repeat(32)}#${index}`),
        new helios.TxOutput(address, new helios.Value(10_000_000n), inlineDatum ? helios.Datum.inline(new helios.IntData(1n)) : null));
}

// Wallet input first, script input last: Test.build gives the redeemer to the last input.
async function spendTest(program, redeemer) {
    const wallet = await getAddressAtDerivation(0);
    return new Test(program, hash => {
        const fixture = new Fixture(hash);
        fixture.inputs = [utxo(1, wallet), utxo(2, fixture.scriptAddress, true)];
        fixture.redeemer = new helios.IntData(redeemer);
        fixture.collateral = utxo(3, wallet);
        return fixture;
    });
}

// Invariant: init parses the fetched parameters with the real NetworkParams.
// Negative control: a different body (e.g. a changed fee) breaks the deepEqual.
test('init loads network parameters from the parameter endpoint', async () => {
    const tester = await initTester();
    assert.deepEqual(tester.networkParams.raw, helios.rawNetworkEmulatorParams);
    assert.deepEqual(tester.networkParams.txFeeParams, [155381, 44]);
});

// Invariant: a validator that accepts the fixture is reported as an approval, and the script really ran.
// Negative control: the same tx with shouldApprove=false is counted as a failure (asserted below).
test('approving validator finalizes through the real evaluator and counts as success', async () => {
    const tester = await initTester();
    const t = await spendTest(validator('redeemer == 42'), 42n);
    await tester.test('HARNESS', 'approve', t);
    assert.deepEqual(tester.getTotals(), { testCount: 1, successCount: 1, failCount: 0 });
    const [redeemer] = t.tx.witnesses.redeemers;
    assert.equal(t.tx.witnesses.redeemers.length, 1);
    assert(redeemer instanceof helios.SpendingRedeemer);
    assert(redeemer.cpuCost > 0n && redeemer.memCost > 0n, 'script execution was budgeted');

    await tester.test('HARNESS', 'approve expected deny', await spendTest(validator('redeemer == 42'), 42n), false);
    assert.deepEqual(tester.getTotals(), { testCount: 2, successCount: 1, failCount: 1 });
});

// Invariant: a DENY expectation passes only when the script fails with the expected message.
test('denial is matched against the validator error message', async () => {
    const tester = await initTester();
    const failing = () => validator('if (redeemer == 42) { error("redeemer rejected") } else { true }');
    await tester.test('HARNESS', 'deny with message', await spendTest(failing(), 42n), false, 'redeemer rejected');
    assert.deepEqual(tester.getTotals(), { testCount: 1, successCount: 1, failCount: 0 });

    await tester.test('HARNESS', 'deny with other message', await spendTest(failing(), 42n), false, 'different reason');
    assert.deepEqual(tester.getTotals(), { testCount: 2, successCount: 1, failCount: 1 });
});

// Invariant: a rejecting validator is never reported as an approval.
test('rejecting validator fails an APPROVE expectation', async () => {
    const tester = await initTester();
    await tester.test('HARNESS', 'wrong redeemer', await spendTest(validator('redeemer == 42'), 7n));
    assert.deepEqual(tester.getTotals(), { testCount: 1, successCount: 0, failCount: 1 });
});
