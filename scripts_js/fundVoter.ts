// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

import { Transaction } from '@mysten/sui/transactions';
import dotenv from 'dotenv';
import path from 'path';
import { getArg, getClient, getSigner, Network } from './utils';

// Load environmental variables
dotenv.config({ path: path.join(__dirname, '.env') });

/**
 * Utility script to transfer SUI from the main account (PRIVATE_KEY)
 * to the voter account (VOTER_PRIVATE_KEY) for gas and poll deposits.
 */
async function main() {
  const args = process.argv.slice(2);
  const network = (getArg(args, '--network') as Network) || 'testnet';
  const client = getClient(network);

  // Default to 1 SUI if no amount provided
  const amountStr = getArg(args, '--amount') || '1.0';
  const amountMIST = BigInt(parseFloat(amountStr) * 1e9);

  // Get signers to derive addresses
  const adminSigner = getSigner(process.env.PRIVATE_KEY);
  const voterSigner = getSigner(process.env.VOTER_PRIVATE_KEY);

  const adminAddress = adminSigner.toSuiAddress();
  const voterAddress = voterSigner.toSuiAddress();

  console.log(`\n💸 Funding Voter Account`);
  console.log(`Source (Admin): ${adminAddress}`);
  console.log(`Destination (Voter): ${voterAddress}`);
  console.log(`Amount: ${amountStr} SUI (${amountMIST} MIST)\n`);

  if (adminAddress === voterAddress) {
    console.error(`❌ Admin and Voter addresses are the same. No transfer needed.`);
    return;
  }

  const tx = new Transaction();
  tx.setSender(adminAddress);

  // Split and transfer
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMIST)]);
  tx.transferObjects([coin], voterAddress);

  try {
    const result = await client.signAndExecuteTransaction({
      signer: adminSigner,
      transaction: tx,
      options: {
        showEffects: true,
      },
    });

    console.log(`✅ Success! Voter account funded.`);
    console.log(`Transaction Digest: ${result.digest}`);
    console.log(`Status: ${result.effects?.status.status}`);
  } catch (e) {
    console.error(`❌ Transfer failed:`, e);
  }
}

main().catch(console.error);
