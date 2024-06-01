import * as helios from '@koralabs/helios'
import { Fixture, getAddressAtDerivation, getNewFakeUtxoId } from './fixtures.js'
import { Color } from './colors.js';
helios.config.set({ IS_TESTNET: false, AUTO_SET_VALIDITY_RANGE: true });

export class Test {
  tx: helios.Tx;
  contract: helios.Program;
  inputs?: helios.TxInput[];
  refInputs?: helios.TxInput[];
  outputs?: helios.TxOutput[];
  signatories?: helios.PubKeyHash[];
  minted?: [helios.ByteArray | helios.ByteArrayProps, helios.HInt | helios.HIntProps][];
  redeemer?: helios.UplcData;
  collateral?: helios.TxInput;
  setupFixture: CallableFunction;
  setupTx?: CallableFunction;
  attachScript: Boolean;
  unoptimzedScriptScbor: helios.UplcProgram;
  
  constructor (contract: helios.Program, fixtures: (hash: helios.ValidatorHash) => Fixture | Promise<Fixture>, setupTx?: (fixture: Fixture) => helios.Tx, attachScript = false) {
    this.contract = contract;
    this.unoptimzedScriptScbor = contract.compile(false)
    this.attachScript = attachScript;
    this.setupTx = setupTx;
    this.setupFixture = fixtures;
  }

  reset(fixtures: Fixture | undefined) {}

  async build() {
    const script = this.contract.compile(true);
    const fixture = await this.setupFixture(new helios.ValidatorHash(script.hash()));
    this.inputs = fixture.inputs;
    this.refInputs = fixture.refInputs;
    this.outputs = fixture.outputs;
    this.signatories = fixture.signatories;
    this.minted = fixture.minted;
    this.redeemer = fixture.redeemer;
    this.collateral = fixture.collateral;
    this.tx = this.setupTx ? this.setupTx(fixture) : new helios.Tx(); 
    if (this.inputs)
        this.inputs.forEach((input, index) => this.tx.addInput(input, (index == ((this.inputs?.length ?? 0) - 1) && this.redeemer) ? this.redeemer : undefined));

    if (this.refInputs)
      this.refInputs.forEach((input) => this.tx.addRefInput(input));
    
    if (this.attachScript) {
      this.tx.attachScript(script)
    }
    else {
      this.tx.addRefInput(new helios.TxInput(
        new helios.TxOutputId(getNewFakeUtxoId()),
        new helios.TxOutput(
            await getAddressAtDerivation(0),
            new helios.Value(BigInt(100000000)),
            null,
            script
        )), script)
    }
    
    if (this.minted)
      this.tx.mintTokens(script.mintingPolicyHash, this.minted, this.redeemer ?? null);
    
    if (this.outputs)
      this.outputs.forEach((output) => this.tx.addOutput(output));

    if (this.signatories)
      this.signatories.forEach((signer) => this.tx.addSigner(signer));

    if (this.collateral)
      this.tx.addCollateral(this.collateral);

    return this.tx;
  }
}

export class ContractTester {
    networkParams: any = {};
    successCount = 0;
    failCount = 0;
    testCount = 0;
    testName: string | undefined;
    groupName: string | undefined;
    changeAddress: helios.Address;
    verbose = false;
  
    constructor (changeAddress?: helios.Address, verbose = false) {
      if (!changeAddress) {
        throw new Error("changeAddress is required")
      }
      this.changeAddress = changeAddress;
      this.verbose = verbose;
    }

    async init (groupName?: string, testName?: string) {
      this.groupName = groupName;
      this.testName = testName;
      this.networkParams = new helios.NetworkParams(
          await fetch(`https://d1t0d7c2nekuk0.cloudfront.net/mainnet.json`).then((response) =>
              response.json()
          )
      );
    }

    cleanTestName() {
      return `${this.groupName}${this.testName}`.replace(/[^a-z0-9]/gi, '');
    }

    async test(group: string, name: string, test: Test, shouldApprove = true, message?:string) {
      if (this.groupName == null || group == this.groupName) {
          if (this.testName == null || name == this.testName) {
            this.testCount++;
            let tx = await test.build();
            try {
              await tx.finalize(this.networkParams ?? {}, this.changeAddress);
              //console.log(JSON.stringify(tx?.dump()));
              // SUCCESS
              this.logTest(tx, shouldApprove, group, name, message);
            }
            catch (error: any) {
              if (this.verbose) {
                console.log(JSON.stringify(tx.dump()));
              }
              if (error.context) {
                  const { context } = error;
                  const args = [helios.UplcData.fromCbor(context.Redeemer), helios.UplcData.fromCbor(context.ScriptContext)];        
                  if ('Datum' in context) {
                      args.unshift(helios.UplcData.fromCbor(context.Datum));
                  }
                  try {
                      const uplcProgram = test.contract.compile(false);
                      const res = await uplcProgram.run(args.map((a) => new helios.UplcDataValue(helios.Site.dummy(), a)));
                      this.logTest(tx, shouldApprove, group, name, message, res);
                      return;
                  } catch (runProgramError) {
                      runProgramError.message = `Error running program: ${runProgramError.message} with error ${error.message}`;
                      console.log(runProgramError);
                      return;
                  }
              }
              this.logTest(tx, shouldApprove, group, name, message, error);
            }
          }
      }
    }
    
    logTest(tx: helios.Tx, shouldApprove: boolean, group: string, test: string, message?: string, error?: any) {
      
      const prints = (error?.message.split(/\r|\n/ig) ?? []).filter((m: string) => m.startsWith('INFO'));
      const hasPrintStatements = prints.length > 0;
      const assertion: boolean = (shouldApprove && !error) || (!shouldApprove && error && (!message || error.message.includes(message)));
      const textColor = assertion ? Color.FgGreen : Color.FgRed
      
      if (!assertion || hasPrintStatements)
        console.log(`${textColor}------------------------------${Color.Reset}`)
      
      const mem = `mem:${tx.witnesses.redeemers.reduce((n, r) => {return n + r.memCost}, BigInt(0))}`;
      const cpu = `cpu:${tx.witnesses.redeemers.reduce((n, r) => {return n + r.cpuCost}, BigInt(0))}`;
      const size = `size:${tx.body.toCbor().length}`;
      console.log(`${textColor}*${assertion ? "success" : "failure"}* - ${(shouldApprove ? "APPROVE" : "DENY").padEnd(7)} - ${group.padEnd(25)} '${test}'${Color.Reset} ( ${mem}, ${cpu}, ${size} )`);
      
      if (hasPrintStatements)
        console.log(`   ${Color.FgYellow}PRINT STATEMENTS:${Color.Reset}\n   ${prints.join("\n   ")}`);
      
      if (assertion) {
        this.successCount++
      }
      else {
        this.failCount++
        console.log(`   ${Color.FgYellow}ERROR:${Color.Reset}`);
        if (error && !hasPrintStatements)
          console.log(error);
        console.log(`\n`)
        console.log(`   ${Color.FgYellow}EXPECTED:\n   ${Color.FgBlue}${message ? message : "success"}${Color.Reset}`);
        console.log(`   ${Color.FgYellow}RECEIVED:`);
        if (prints.length > 0) {
          // Helios error() is always the last in the output/print statements res[1].length-1]
          console.log(`   ${Color.FgRed}${prints[prints.length-1]}${Color.Reset}`);
        }
        else {
          console.log(`   ${Color.FgRed}${shouldApprove ? "tx denied" : "tx approved"}${Color.Reset}`);
        }
      }
      
      if (!assertion || hasPrintStatements)
      console.log(`${textColor}------------------------------${Color.Reset}`)
    }
    
    displayStats() {
      console.log(`${Color.FgBlue}** SUMMARY **${Color.Reset}`)
      console.log(`${Color.FgBlue}${this.testCount.toString().padStart(5)} total tests${Color.Reset}`)
      if (this.successCount > 0)
        console.log(`${Color.FgGreen}${this.successCount.toString().padStart(5)} successful${Color.Reset}`)
      if (this.failCount > 0)
        console.log(`${Color.FgRed}${this.failCount.toString().padStart(5)} failed${Color.Reset}`)
    }
    
    getTotals() {
      return {testCount: this.testCount, successCount: this.successCount, failCount: this.failCount}
    }

}
