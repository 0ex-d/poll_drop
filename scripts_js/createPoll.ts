// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

import { Transaction } from '@mysten/sui/transactions';
import dotenv from 'dotenv';
import path from 'path';
import {
  getArg,
  getClient,
  getSigner,
  inspectTransaction,
  Network,
  setupGasPayment,
} from './utils';

// Load env from parent directory
dotenv.config({ path: path.join(__dirname, '.env') });

const PACKAGE_ID = process.env.PACKAGE_ID;
const NETWORK = (process.env.NETWORK as Network) || 'testnet';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  if (!PACKAGE_ID) {
    throw new Error('PACKAGE_ID not found in .env');
  }

  // Parse command line arguments
  const args = process.argv.slice(2);

  const network = (getArg(args, '--network') as Network) || NETWORK;
  const client = getClient(network);

  // Get Signer
  const signer = getSigner(process.env.PRIVATE_KEY);
  const senderAddress = signer.toSuiAddress();

  const title = getArg(args, '--title') || 'New Community Poll';
  const optionsStr = getArg(args, '--options') || 'Yes,No';
  const options = optionsStr.split(',').map((o) => o.trim());

  // Deposit in MIST (1 SUI = 1,000,000,000 MIST)
  const depositAmount = BigInt(getArg(args, '--deposit_mist') || 100_000_000); // Default 0.1 SUI

  // Duration in hours
  const durationHours = Number(getArg(args, '--duration_hours') || 24);
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;

  const treasury = getArg(args, '--treasury') || senderAddress;
  const manualGasId = getArg(args, '--gas');

  console.log(`\n🚀 Creating poll on ${network}`);
  console.log(`Title: ${title}`);
  console.log(`Options: ${options.join(', ')}`);
  console.log(`Deposit: ${Number(depositAmount) / 1e9} SUI`);
  console.log(
    `Duration: ${durationHours} hours (Expires: ${new Date(expiresAt).toLocaleString()})`,
  );
  console.log(`Treasury: ${treasury}`);
  console.log(`Signer: ${senderAddress}`);

  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Set gas payment if provided
  if (manualGasId) await setupGasPayment(tx, manualGasId, client);

  // Split coin for deposit
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(depositAmount)]);

  // Move Call: create_poll(options, expires_at, title, deposit_amount, platform_treasury, creator_deposit, clock, ctx)
  tx.moveCall({
    target: `${PACKAGE_ID}::poll::create_poll`,
    arguments: [
      tx.pure.vector('string', options),
      tx.pure.u64(expiresAt),
      tx.pure.string(title),
      tx.pure.u64(depositAmount),
      tx.pure.address(treasury),
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
      signer: signer,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    console.log('\n✅ Poll Created Successfully!');
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
    console.error('\n❌ Failed to create poll:', e);
  }
}

main().catch(console.error);
