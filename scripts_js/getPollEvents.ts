// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

import dotenv from 'dotenv';
import path from 'path';
import { getClient, Network } from './utils';

dotenv.config({ path: path.join(__dirname, '.env') });

const PACKAGE_ID = process.env.PACKAGE_ID;
const NETWORK = (process.env.NETWORK as Network) || 'testnet';

async function main() {
  if (!PACKAGE_ID) {
    throw new Error('PACKAGE_ID not found in .env');
  }

  const client = getClient(NETWORK);
  console.log(`Fetching poll events for package: ${PACKAGE_ID} on ${NETWORK}...`);

  try {
    const events = await client.queryEvents({
      query: {
        MoveModule: {
          package: PACKAGE_ID,
          module: 'poll',
        },
      },
      limit: 10,
      order: 'descending', // Show newest first
    });

    if (events.data.length === 0) {
      console.log('No stored events found.');
      return;
    }

    console.log(`Found ${events.data.length} events:`);

    events.data.forEach((e, index) => {
      console.log(`\n--- Event ${index + 1} ---`);
      console.log(`Type: ${e.type}`);
      console.log(`Tx Digest: ${e.id.txDigest}`);
      console.log(
        `Timestamp: ${new Date(Number(e.timestampMs)).toLocaleString('en-US', { timeZone: 'UTC' })}`,
      );
      console.log(`Details:`, e.parsedJson);
    });
  } catch (e) {
    console.error('Error fetching events:', e);
  }
}

main().catch(console.error);
