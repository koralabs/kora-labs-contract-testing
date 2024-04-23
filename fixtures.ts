import * as helios from '@hyperionbt/helios'
import * as https from 'https'
import { mnemonicToEntropy } from 'bip39';
import bip32 from '@stricahq/bip32ed25519';
import { HANDLE_POLICIES, Network } from '@koralabs/kora-labs-common'

helios.config.set({ IS_TESTNET: false, AUTO_SET_VALIDITY_RANGE: true });
const NETWORK = (process.env.NETWORK ?? 'preview').toLowerCase() as Network
export const handlesPolicy = helios.MintingPolicyHash.fromHex(HANDLE_POLICIES.getActivePolicy(NETWORK) ?? '');

export const getKeyFromSeedPhrase = async (seed: string[], derivation = 0): Promise<bip32.PrivateKey> => {
    const entropy = mnemonicToEntropy(seed.join(' '));
    const buffer = Buffer.from(entropy, 'hex');
    const rootKey = await bip32.Bip32PrivateKey.fromEntropy(buffer);
    return rootKey.derive(2147483648 + 1852).derive(2147483648 + 1815).derive(2147483648 + 0).derive(0).derive(derivation).toPrivateKey();
}

export const getAddressAtDerivation = async (seed: string[], derivation: number = 0) => {
    return helios.Address.fromHash(new helios.PubKeyHash([...(await getKeyFromSeedPhrase(seed, derivation)).toPublicKey().hash()])).toBech32();
}

export const testSeedPhrase = ['hurdle', 'exile', 'essence', 'fitness', 'winter', 'unaware', 'coil', 'polar', 'vocal', 'like', 'tuition', 'story', 'consider', 'weasel', 'shove', 'donkey', 'effort', 'nice', 'any', 'buffalo', 'trip', 'amount', 'hundred', 'duty'];

export class Fixtures {
    inputs?: helios.TxInput[];
    refInputs?: helios.TxInput[];
    outputs?: helios.TxOutput[];
    signatories?: helios.PubKeyHash[];
    minted?: [helios.ByteArray | helios.ByteArrayProps, helios.HInt | helios.HIntProps][];
    redeemer?: helios.UplcData;
    walletAddress?: string;
    constructor() {}
    initialize = async (): Promise<Fixtures> =>
    {
        this.walletAddress = await getAddressAtDerivation(testSeedPhrase);
        
        // Fill out the above transaction components here
        return this;
    }
}

export const convertJsontoCbor = (json: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(json);
        const options = {
        hostname: 'preview.api.handle.me',
        port: 443,
        path: '/datum?from=json&to=plutus_data_cbor&numeric_keys=true',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
            'Accept': 'text/plain'
            }
        };
        let data = '';
        const req = https.request(options, (res) => {
            res.on('data', (d) => {
                data += d;
            });
            res.on('end', () => {
                resolve(data);
            })
        });
        
        req.on('error', (e) => {
            reject(e);
        });
        
        req.write(postData);
        req.end(); 
    });
}