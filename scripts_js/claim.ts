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
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  if (!PACKAGE_ID) {
    throw new Error('PACKAGE_ID not found in .env');
  }

  // Parse command line arguments
  const args = process.argv.slice(2);

  const network = (getArg(args, '--network') as Network) || 'testnet';
  const client = getClient(network);

  const pollId = getArg(args, '--poll');
  if (!pollId) {
    throw new Error(`POLL_ID not found. Pass it via --poll`);
  }

  // Get Signer (using VOTER_PRIVATE_KEY as primary, fallback to PRIVATE_KEY)
  const signer = getSigner(process.env.VOTER_PRIVATE_KEY || process.env.PRIVATE_KEY);
  const senderAddress = signer.toSuiAddress();

  const manualGasId = getArg(args, '--gas');

  console.log(`\n💰 Claiming Rewards for Poll: ${pollId}`);
  console.log(`Network: ${network}`);
  console.log(`Signer: ${senderAddress}`);

  // Check poll status
  console.log('\nChecking eligibility...');
  const pollObj = await client.getObject({
    id: pollId,
    options: { showContent: true },
  });

  const content = pollObj.data?.content as any;
  if (!content?.fields) {
    throw new Error('Failed to fetch poll data');
  }

  const winningOption = content.fields.winning_option;
  const claimed = content.fields.claimed as string[];
  const voters = content.fields.voters as string[];
  const voteChoices = content.fields.vote_choices as string[];

  // 1. Check if finalized
  if (!winningOption || !winningOption.vec || winningOption.vec.length === 0) {
    console.error(
      `❌ Poll has not been finalized yet! Run 'npm run finalize -- --poll ${pollId}' first.`,
    );
    return;
  }

  const winningIdx = winningOption.vec[0];
  console.log(`Winning Option Index: ${winningIdx}`);

  // 2. Check if user already claimed
  if (claimed.includes(senderAddress)) {
    console.error(`❌ You have already claimed your reward for this poll!`);
    return;
  }

  // 3. Check if user is a winner
  const voterIdx = voters.indexOf(senderAddress);
  if (voterIdx === -1) {
    console.error(`❌ You didn't vote in this poll!`);
    return;
  }

  const userChoice = voteChoices[voterIdx];
  if (userChoice !== winningIdx) {
    console.error(
      `❌ You didn't vote for the winning option (${winningIdx}). Your vote: ${userChoice}`,
    );
    return;
  }

  console.log(`✅ You are eligible to claim rewards!`);

  // Build claim transaction
  const tx = new Transaction();
  tx.setSender(senderAddress);

  if (manualGasId) await setupGasPayment(tx, manualGasId, client);

  // Move Call: public fun claim_reward(poll: &mut Poll, ctx: &mut TxContext)
  tx.moveCall({
    target: `${PACKAGE_ID}::poll::claim_reward`,
    arguments: [tx.object(pollId)],
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

    console.log('\n✅ Reward Claimed Successfully!');
    console.log('Digest:', result.digest);
    console.log('Status:', result.effects?.status.status);

    if (result.events) {
      console.log('\nEvents Emitted:');
      result.events.forEach((e) => {
        console.log(`Type: ${e.type}`);
        if (e.type.includes('::ClaimEvent')) {
          console.log(`Amount: ${Number((e.parsedJson as any).amount) / 1e9} SUI`);
        }
        console.dir(e.parsedJson, { depth: null });
      });
    }
  } catch (e) {
    console.error('\n❌ Failed to claim reward:', e);
  }
}

main().catch(console.error);
