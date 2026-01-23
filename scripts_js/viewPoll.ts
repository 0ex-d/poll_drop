// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

import dotenv from 'dotenv';
import path from 'path';
import { getArg, getClient, Network, timeAgo } from './utils';

// Load environmental variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const network = (getArg(args, '--network') as Network) || 'testnet';
  const client = getClient(network);

  const pollId = getArg(args, '--poll');
  if (!pollId) {
    throw new Error(`POLL_ID not provided. Pass it via --poll`);
  }

  console.log(`\n🔍 Fetching Poll Details: ${pollId}`);
  console.log(`Network: ${network}\n`);

  try {
    const pollObj = await client.getObject({
      id: pollId,
      options: { showContent: true },
    });

    const content = pollObj.data?.content as any;
    if (!content?.fields) {
      throw new Error('Failed to fetch poll data. Ensure the ID is correct.');
    }

    const fields = content.fields;
    const now = Date.now();
    const expiresAt = Number(fields.expires_at);
    const isExpired = now >= expiresAt;

    // Basic Info
    console.log(`Title: ${fields.title}`);
    console.log(`Creator: ${fields.creator}`);
    console.log(`Treasury: ${fields.platform_treasury}`);
    console.log(`Deposit Required: ${Number(fields.deposit_amount) / 1e9} SUI`);
    console.log(`Created: ${new Date(Number(fields.timestamp)).toLocaleString()}`);
    console.log(
      `Expires: ${new Date(expiresAt).toLocaleString()} (${timeAgo(expiresAt)})${isExpired ? ' [EXPIRED]' : ''}`,
    );

    // Pool & Distribution
    const poolSize = Number(fields.pool) / 1e9;
    console.log(`Total Pool: ${poolSize.toFixed(4)} SUI`);
    console.log(`Total Voters: ${fields.voters.length}`);

    // Results logic
    const votes = fields.votes as string[];
    const options = fields.options as string[];
    const winningOption = fields.winning_option; // Option<u64>

    console.log('\n--- Vote Distribution ---');
    votes.forEach((count, idx) => {
      const isWinner =
        winningOption && winningOption.vec && winningOption.vec.length > 0
          ? winningOption.vec[0] === idx.toString()
          : false;

      console.log(`${isWinner ? '🏆' : '  '} ${idx}. ${options[idx].padEnd(20)} : ${count} votes`);
    });

    // Finalization status
    if (winningOption && winningOption.vec && winningOption.vec.length > 0) {
      console.log(`\nStatus: ✅ FINALIZED`);
      console.log(`Winner Option Index: ${winningOption.vec[0]}`);
      console.log(
        `Claimed Count: ${fields.claimed.length} / ${votes[Number(winningOption.vec[0])]}`,
      );
    } else {
      console.log(`\nStatus: 🗳️  ${isExpired ? 'READY TO FINALIZE' : 'OPEN'}`);
    }
  } catch (e) {
    console.error(`❌ Error viewing poll:`, e instanceof Error ? e.message : e);
  }
}

main().catch(console.error);
