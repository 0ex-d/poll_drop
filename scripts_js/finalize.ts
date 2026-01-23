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
  timeAgo,
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

  // Get Signer
  const signer = getSigner(process.env.PRIVATE_KEY);
  const senderAddress = signer.toSuiAddress();

  const manualGasId = getArg(args, '--gas');

  console.log(`\n🚀 Finalizing Poll: ${pollId}`);
  console.log(`Network: ${network}`);
  console.log(`Signer: ${senderAddress}`);

  // Check poll status
  console.log('\nChecking poll status...');
  const pollObj = await client.getObject({
    id: pollId,
    options: { showContent: true },
  });

  const content = pollObj.data?.content as any;
  if (!content?.fields) {
    throw new Error('Failed to fetch poll data');
  }

  const expiresAt = Number(content.fields.expires_at);
  const winningOption = content.fields.winning_option;
  const now = Date.now();

  // Check if already finalized
  if (winningOption && winningOption.vec && winningOption.vec.length > 0) {
    console.error(`❌ Poll has already been finalized!`);
    console.error(`Winning option: ${winningOption.vec[0]}`);
    return;
  }

  // Check if poll has expired
  if (now < expiresAt) {
    console.error(`❌ Poll has not expired yet!`);
    console.error(`Expires at: ${new Date(expiresAt).toLocaleString()} | ${timeAgo(expiresAt)}`);
    console.error(`Current time: ${new Date(now).toLocaleString()}`);
    return;
  }

  console.log(
    `✅ Poll is ready to finalize (Expired: ${new Date(expiresAt).toLocaleString()} | ${timeAgo(expiresAt)})`,
  );

  // Display poll stats
  const votes = content.fields.votes as string[];
  const options = content.fields.options as string[];
  const totalVotes = content.fields.voters?.length || 0;

  console.log(`\nPoll Statistics:`);
  console.log(`Title: ${content.fields.title}`);
  console.log(`Total Voters: ${totalVotes}`);
  console.log(`\nVote Distribution:`);
  votes.forEach((count: string, idx: number) => {
    console.log(`  ${idx}. ${options[idx]}: ${count} votes`);
  });

  // Build finalize transaction
  const tx = new Transaction();
  tx.setSender(senderAddress);

  if (manualGasId) await setupGasPayment(tx, manualGasId, client);

  // Move Call: public fun finalize(poll: &mut Poll, clock: &Clock, _ctx: &mut TxContext)
  tx.moveCall({
    target: `${PACKAGE_ID}::poll::finalize`,
    arguments: [
      tx.object(pollId),
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

    console.log('\n✅ Poll Finalized Successfully!');
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
    console.error('\n❌ Failed to finalize poll:', e);
  }
}

main().catch(console.error);
