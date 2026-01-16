
import { execSync } from 'child_process';
import fs, { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';

export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const SUI = process.env.SUI_BINARY ?? `sui`;

export const getActiveAddress = () => {
	return execSync(`${SUI} client active-address`, { encoding: 'utf8' }).trim();
};


/// Returns a signer based on the active address of system's sui.
export const getSigner = (pk?: string) => {
	if (pk) {
		console.log('Using supplied private key.');
		const { secretKey } = decodeSuiPrivateKey(pk.toLocaleLowerCase());

		return Ed25519Keypair.fromSecretKey(secretKey)
	}

	const sender = getActiveAddress();

	const keystore = JSON.parse(
		readFileSync(path.join(homedir(), '.sui', 'sui_config', 'sui.keystore'), 'utf8'),
	);

	for (const priv of keystore) {
		const raw = fromBase64(priv);
		if (raw[0] !== 0) {
			continue;
		}

		const pair = Ed25519Keypair.fromSecretKey(raw.slice(1));
		if (pair.getPublicKey().toSuiAddress() === sender) {
			return pair;
		}
	}

	throw new Error(`keypair not found for sender: ${sender}`);
};

/// Get the client for the specified network.
export const getClient = (network: Network) => {
	const url = process.env.RPC_URL || getFullnodeUrl(network);
	return new SuiClient({ url });
};

