// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

/**
 * Combine Signatures and Submit Transaction
 *
 * This script combines individual signatures from multiple signers into a
 * multisig signature and submits the transaction to the Sui network.
 *
 * Usage:
 *   npm run combine-submit -- --tx <tx-file> --network <network>
 *
 * Example:
 *   npm run combine-submit -- --tx ../tx/tx-data.txt --network testnet
 */

import { SuiClient } from '@mysten/sui/client';
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { fromBase64 } from '@mysten/sui/utils';
import fs from 'fs';
import path from 'path';
import { getClient, Network } from '../utils';

type KeyScheme = 'ED25519' | 'Secp256k1' | 'Secp256r1';

interface SignatureFile {
  signerIndex: number;
  signerAddress: string;
  publicKey: string;
  signature: string;
  scheme: KeyScheme;
  signedAt: string;
}

interface MultisigConfig {
  multisigAddress: string;
  threshold: number;
  signers: Array<{
    index: number;
    publicKey: string;
    weight: number;
    scheme: KeyScheme;
  }>;
}

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };

  // Parse arguments
  const txFile = getArg('--tx') || '../tx/tx-data.txt';
  const network = (getArg('--network') || 'testnet') as Network;

  console.log(`\n🔐 Combining Multisig Signatures`);
  console.log(`Transaction file: ${txFile}`);
  console.log(`Network: ${network}\n`);

  // Load multisig configuration
  const configPath = path.join(__dirname, 'multisig-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Multisig config not found: ${configPath}\nRun setupMultisig.ts first!`);
  }

  const config: MultisigConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log(`Multisig Address: ${config.multisigAddress}`);
  console.log(`Threshold: ${config.threshold}`);
  console.log(`Total Signers: ${config.signers.length}\n`);

  // Load unsigned transaction
  const txPath = path.resolve(__dirname, txFile);
  if (!fs.existsSync(txPath)) {
    throw new Error(`Transaction file not found: ${txPath}`);
  }

  const txBase64 = fs.readFileSync(txPath, 'utf-8').trim();
  const txBytes = fromBase64(txBase64);

  console.log(`✅ Loaded unsigned transaction (${txBytes.length} bytes)`);

  // Load all signature files
  const signaturesDir = path.join(__dirname, 'signatures');
  if (!fs.existsSync(signaturesDir)) {
    throw new Error(`Signatures directory not found: ${signaturesDir}`);
  }

  const signatureFiles = fs
    .readdirSync(signaturesDir)
    .filter((f) => f.startsWith('signature-') && f.endsWith('.json'));

  if (signatureFiles.length === 0) {
    throw new Error('No signature files found! Signers must run signMultisigTx.ts first.');
  }

  console.log(`\nFound ${signatureFiles.length} signature(s):`);

  const signatures: SignatureFile[] = [];
  for (const file of signatureFiles) {
    const sigPath = path.join(signaturesDir, file);
    const sig: SignatureFile = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
    signatures.push(sig);
    console.log(`  - Signer ${sig.signerIndex}: ${sig.signerAddress} (${sig.scheme})`);
  }

  // Verify we have enough signatures
  const totalWeight = signatures.reduce((sum, sig) => {
    const signer = config.signers.find((s) => s.index === sig.signerIndex);
    return sum + (signer?.weight || 0);
  }, 0);

  if (totalWeight < config.threshold) {
    throw new Error(
      `Insufficient signatures! Need weight ${config.threshold}, have ${totalWeight}\n` +
        `Collected ${signatures.length} signature(s) with total weight ${totalWeight}`,
    );
  }

  console.log(`\n✅ Sufficient signatures (weight: ${totalWeight}/${config.threshold})`);

  // Reconstruct multisig public key
  const publicKeys = config.signers.map((signer) => {
    let pubKey;
    switch (signer.scheme) {
      case 'ED25519':
        pubKey = new Ed25519PublicKey(signer.publicKey);
        break;
      case 'Secp256k1':
        pubKey = new Secp256k1PublicKey(signer.publicKey);
        break;
      case 'Secp256r1':
        pubKey = new Secp256r1PublicKey(signer.publicKey);
        break;
      default:
        throw new Error(`Unsupported key scheme: ${signer.scheme}`);
    }

    return {
      publicKey: pubKey,
      weight: signer.weight,
    };
  });

  const multisigPublicKey = MultiSigPublicKey.fromPublicKeys({
    threshold: config.threshold,
    publicKeys,
  });

  // Combine signatures - signatures are already in base64 string format
  const signatureStrings = signatures.map((sig) => sig.signature);
  const combinedSignature = multisigPublicKey.combinePartialSignatures(signatureStrings);

  console.log(`\n✅ Signatures combined successfully!`);

  // Submit transaction
  console.log(`\n📡 Submitting transaction to ${network}...`);
  const client = getClient(network);

  try {
    const result = await client.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: combinedSignature,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    console.log(`\n✅ Transaction executed successfully!`);
    console.log(`Digest: ${result.digest}`);
    console.log(`Status: ${result.effects?.status.status}`);

    if (result.effects?.status.status === 'failure') {
      console.error(`\n❌ Transaction failed!`);
      console.error(`Error: ${result.effects.status.error}`);
    }

    if (result.events && result.events.length > 0) {
      console.log(`\n📋 Events Emitted:`);
      result.events.forEach((e, idx) => {
        console.log(`\nEvent ${idx + 1}:`);
        console.log(`  Type: ${e.type}`);
        console.log(`  Data:`, JSON.stringify(e.parsedJson, null, 2));
      });
    }

    if (result.objectChanges && result.objectChanges.length > 0) {
      console.log(`\n📦 Object Changes:`);
      result.objectChanges.forEach((change, idx) => {
        console.log(`\nChange ${idx + 1}:`, change);
      });
    }

    // Save result to file
    const resultPath = path.join(__dirname, 'last-tx-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 Full result saved to: ${resultPath}`);
  } catch (error) {
    console.error(`\n❌ Failed to execute transaction:`, error);
    throw error;
  }
}

main().catch(console.error);
