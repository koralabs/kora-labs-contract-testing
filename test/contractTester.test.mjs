import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as helios from '@koralabs/helios';
import { Test } from '../lib/contractTester.js';
import { Fixture } from '../lib/fixtures.js';

// Real compiler + transaction API, no network, wallets, signing or evaluator mocks.
const minting = helios.Program.new(`minting harness_mint
func main(_, _) -> Bool { true }`);
const spending = helios.Program.new(`spending harness_spend
func main(_, _, _) -> Bool { true }`);
const scriptAddress = helios.Address.fromHash(spending.compile(true).validatorHash);
const walletAddress = helios.Address.fromHash(new helios.PubKeyHash('11'.repeat(28)));
const redeemer = new helios.ConstrData(0, []);

function input(index, address) {
    return new helios.TxInput(new helios.TxOutputId(`${'00'.repeat(32)}#${index}`),
        new helios.TxOutput(address, new helios.Value(10_000_000n),
            address.validatorHash ? helios.Datum.inline(new helios.IntData(42n)) : null));
}

// Invariant: minting redeemers never attach to public-key inputs.
// Negative control: the published last-input-position loop throws on this real input.
test('mint-only fixture keeps its public-key input and only a minting redeemer', async () => {
    const tx = await new Test(minting, hash => {
        const fixture = new Fixture(hash);
        fixture.inputs = [input(0, walletAddress)];
        fixture.minted = [['00', 1n]];
        fixture.redeemer = redeemer;
        return fixture;
    }, undefined, true).build();
    assert.equal(tx.body.inputs.length, 1);
    assert.equal(tx.body.inputs[0].origOutput.address.toBech32(), walletAddress.toBech32());
    assert.equal(tx.witnesses.redeemers.length, 1);
    assert(tx.witnesses.redeemers[0] instanceof helios.MintingRedeemer);
    assert.deepEqual(tx.witnesses.redeemers[0].data.toCbor(), redeemer.toCbor());
});

// Invariant: spending redeemers follow the script credential, not input order.
// Negative control: the original loop rejects the script-first/public-key-last case.
test('spending redeemer reaches the script input in either input order', async () => {
    for (const scriptFirst of [true, false]) {
        const tx = await new Test(spending, hash => {
            const fixture = new Fixture(hash);
            const script = input(0, scriptAddress);
            const wallet = input(1, walletAddress);
            fixture.inputs = scriptFirst ? [script, wallet] : [wallet, script];
            fixture.redeemer = redeemer;
            return fixture;
        }, undefined, true).build();
        assert.equal(tx.body.inputs.length, 2);
        assert.deepEqual(tx.body.inputs.map(i => i.origOutput.address.toBech32()).sort(),
            [scriptAddress.toBech32(), walletAddress.toBech32()].sort());
        assert.equal(tx.witnesses.redeemers.length, 1);
        assert(tx.witnesses.redeemers[0] instanceof helios.SpendingRedeemer);
        assert.deepEqual(tx.witnesses.redeemers[0].data.toCbor(), redeemer.toCbor());
    }
});

// Invariant: public-key fixtures need no spending redeemer.
// Passing a made-up redeemer to every input makes this fail in the real Tx API.
test('public-key-only fixture without a redeemer does not invent one', async () => {
    const tx = await new Test(minting, hash => {
        const fixture = new Fixture(hash);
        fixture.inputs = [input(0, walletAddress)];
        return fixture;
    }, undefined, true).build();
    assert.equal(tx.body.inputs.length, 1);
    assert.equal(tx.witnesses.redeemers.length, 0);
});

// Invariant: missing script redeemers remain invalid, rather than silently replaced.
// Supplying a default ConstrData in Test.build would break this assertion.
test('script input without a required redeemer is rejected', async () => {
    await assert.rejects(new Test(spending, hash => {
        const fixture = new Fixture(hash);
        fixture.inputs = [input(0, scriptAddress)];
        return fixture;
    }, undefined, true).build(), /input is locked by a script, but redeemer isn't specified/);
});
