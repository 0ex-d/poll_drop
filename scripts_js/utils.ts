// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

import { execSync } from 'child_process';
import fs, { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';

export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const SUI = process.env.SUI_BINARY ?? `sui`;
const ADMIN_CAP_OWNER = process.env.ADMIN_CAP_OWNER || '';

export const getActiveAddress = () => {
  return execSync(`${SUI} client active-address`, { encoding: 'utf8' }).trim();
};

export const getAdminAddress = () => {
  const adminAddress = ADMIN_CAP_OWNER ?? getActiveAddress();
  console.debug(`Admin Address: ${adminAddress}`);
  return adminAddress;
};

/// Returns a signer based on the active address of system's sui.
export const getSigner = (pk?: string) => {
  if (pk) {
    console.debug('Using supplied private key.');
    const { secretKey } = decodeSuiPrivateKey(pk.toLocaleLowerCase());

    return Ed25519Keypair.fromSecretKey(secretKey);
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

/// Builds a transaction (unsigned)
export const prepareMultisigTx = async (
  tx: Transaction,
  network: Network,
  address?: string,
  gasObjectId?: string | null,
) => {
  const adminAddress = address ?? getActiveAddress();
  const client = getClient(network);

  // enabling the gas Object check only on mainnet, to allow testnet multisig tests.
  if (!gasObjectId) throw new Error('No gas object supplied for a mainnet transaction');

  //  if (manualGasId) console.log(`Using specific gas object: ${manualGasId}`);

  // Prevent any possible RGP changes across epoch change, which would invalidate the transaction.
  tx.setGasPrice(1_000);

  // set the sender to be the admin address from config.
  tx.setSender(adminAddress as string);

  // setting up gas object for the multi-sig transaction
  if (gasObjectId) await setupGasPayment(tx, gasObjectId, client);

  // first do a dryRun, to make sure we are getting a success.
  const dryRun = await inspectTransaction(tx, client);

  if (!dryRun) throw new Error('This transaction failed.');

  tx.build({
    client: client,
  }).then((bytes) => {
    let serializedBase64 = toBase64(bytes);

    const output_location =
      process.env.NODE_ENV === 'development' ? './tx/tx-data-local.txt' : './tx/tx-data.txt';

    fs.writeFileSync(output_location, serializedBase64);
  });
};

export async function setupGasPayment(tx: Transaction, gasObjectId: string, client: SuiClient) {
  const gasObject = await client.getObject({
    id: gasObjectId,
  });

  if (!gasObject.data) throw new Error('Invalid Gas Object supplied.');

  console.log(`Using specific gas object: ${gasObjectId}`);

  // set the gas payment.
  tx.setGasPayment([
    {
      objectId: gasObject.data.objectId,
      version: gasObject.data.version,
      digest: gasObject.data.digest,
    },
  ]);
}

export async function inspectTransaction(tx: Transaction, client: SuiClient): Promise<boolean> {
  console.log('Dry Run Mode Enabled');

  const result = await client.dryRunTransactionBlock({
    transactionBlock: await tx.build({ client: client }),
  });

  console.log('Dry Run Result Status:', result.effects.status.status);

  if (result.effects.status.status === 'failure') {
    console.error('Failure Reason:', result.effects.status.error);
  }

  // log the result.
  console.dir(result, { depth: null });

  return result.effects.status.status === 'success';
}

export const timeAgo = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const isFuture = diff < 0;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let timeString = '';
  if (years > 0) timeString = `${years} year${years > 1 ? 's' : ''}`;
  else if (months > 0) timeString = `${months} month${months > 1 ? 's' : ''}`;
  else if (weeks > 0) timeString = `${weeks} week${weeks > 1 ? 's' : ''}`;
  else if (days > 0) timeString = `${days} day${days > 1 ? 's' : ''}`;
  else if (hours > 0) timeString = `${hours} hour${hours > 1 ? 's' : ''}`;
  else if (minutes > 0) timeString = `${minutes} minute${minutes > 1 ? 's' : ''}`;
  else timeString = `${seconds} second${seconds !== 1 ? 's' : ''}`;

  return isFuture ? `in ${timeString}` : `${timeString} ago`;
};

export const getArg = (args: string[], flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
