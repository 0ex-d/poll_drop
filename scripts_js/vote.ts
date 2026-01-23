// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

import { Transaction } from '@mysten/sui/transactions';
import dotenv from 'dotenv';
import path from 'path';
import {
  getArg,
  getAdminAddress,
  getClient,
  getSigner,
  inspectTransaction,
  Network,
  timeAgo,
} from './utils';

// Load env from parent directory
dotenv.config({ path: path.join(__dirname, '.env') });

const PACKAGE_ID = process.env.PACKAGE_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';
const NETWORK = 'testnet';
const ADMIN_CAP_OWNER = process.env.ADMIN_CAP_OWNER || '';

async function main() {
  if (!PACKAGE_ID) {
    throw new Error('PACKAGE_ID not found in .env');
  }

  // Parse command line arguments
  const args = process.argv.slice(2);

  const pollId = getArg(args, '--poll');
  if (!pollId) {
    throw new Error(`POLL_ID not found for ${NETWORK} in constants.ts or arguments`);
  }

  const adminAddress = getAdminAddress();
  const client = getClient(NETWORK);

  const manualGasId = getArg(args, '--gas');
  const voteIndex = Number(getArg(args, '--index') ?? 0);

  const sender = getSigner(process.env.VOTER_PRIVATE_KEY);
  const senderAddress = sender.getPublicKey().toSuiAddress();
  console.log(`Sender: ${senderAddress}`);
  console.log(`Voting on Poll: ${pollId}`);
  console.log(`Vote Index: ${voteIndex}`);

  if (manualGasId) console.log(`Using specific gas object: ${manualGasId}`);

  // Check if poll is expired
  console.log('Checking poll status...');
  const pollObj = await client.getObject({
    id: pollId,
    options: { showContent: true },
  });

  const content = pollObj.data?.content as any;
  if (!content?.fields) {
    throw new Error('Failed to fetch poll data');
  }

  const pollDepositAmount = BigInt(content.fields.deposit_amount);
  console.log(`Required Deposit: ${Number(pollDepositAmount) / 1e9} SUI`);

  if (content?.fields?.expires_at) {
    const expiresAt = Number(content.fields.expires_at);
    const now = Date.now();
    if (now >= expiresAt) {
      console.error(`❌ Poll has expired!`);
      console.error(`Expired at: ${new Date(expiresAt).toLocaleString()} | ${timeAgo(expiresAt)}`);
      console.error(`Current time: ${new Date(now).toLocaleString()}`);
      return;
    }
    console.log(
      `Poll is active (Expires: ${new Date(expiresAt).toLocaleString()} | ${timeAgo(expiresAt)})`,
    );
  }

  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Split coin for deposit
  const gasToSplit = manualGasId ? tx.object(manualGasId) : tx.gas;
  const [coin] = tx.splitCoins(gasToSplit, [tx.pure.u64(pollDepositAmount)]);

  // Move Call
  // public fun vote(poll: &mut Poll, vote_index: u64, payment: Coin<SUI>, clock: &Clock, ctx: &mut TxContext)
  tx.moveCall({
    target: `${PACKAGE_ID}::poll::vote`,
    arguments: [
      tx.object(pollId),
      tx.pure.u64(voteIndex),
      coin,
      tx.object('0x6'), // Clock object ID
    ],
  });

  if (DRY_RUN) {
    await inspectTransaction(tx, client);
    return;
  }

  // Sign and Execute
  try {
    const result = await client.signAndExecuteTransaction({
      signer: sender,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    console.log('Vote Cast Successfully!');
    console.log('Digest:', result.digest);
    console.log('Status:', result.effects?.status.status);

    if (result.events) {
      console.log('\nEvents Emitted:');
      result.events.forEach((e) => {
        console.log(`Type: ${e.type}`);
        console.log(`Data:`, e.parsedJson);
      });
    }
  } catch (e) {
    console.error('Failed to cast vote:', e);
  }
}

main().catch(console.error);
