// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

/**
 * Sign Multisig Transaction
 *
 * This script allows individual signers to sign a prepared multisig transaction.
 * Each signer loads the unsigned transaction, signs it with their private key,
 * and saves their signature to a file.
 *
 * Usage:
 *   npm run sign-multisig -- --tx <tx-file> --pk <private-key> --index <signer-index>
 *
 * Example:
 *   npm run sign-multisig -- --tx ../tx/tx-data.txt --pk <your-private-key> --index 0
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import fs from 'fs';
import path from 'path';

type KeyScheme = 'ED25519' | 'Secp256k1' | 'Secp256r1';

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };

  // Parse arguments
  const txFile = getArg('--tx') || '../tx/tx-data.txt';
  const privateKey = getArg('--pk') || process.env.SIGNER_PRIVATE_KEY;
  const signerIndex = parseInt(getArg('--index') || '0');
  const scheme = (getArg('--scheme') || 'ED25519') as KeyScheme;

  if (!privateKey) {
    throw new Error('Private key is required (--pk <key> or SIGNER_PRIVATE_KEY env var)');
  }

  console.log(`\n🔐 Signing Multisig Transaction`);
  console.log(`Transaction file: ${txFile}`);
  console.log(`Signer index: ${signerIndex}`);
  console.log(`Key scheme: ${scheme}\n`);

  // Load unsigned transaction
  const txPath = path.resolve(__dirname, txFile);
  if (!fs.existsSync(txPath)) {
    throw new Error(`Transaction file not found: ${txPath}`);
  }

  const txBase64 = fs.readFileSync(txPath, 'utf-8').trim();
  const txBytes = fromBase64(txBase64);

  console.log(`✅ Loaded unsigned transaction (${txBytes.length} bytes)`);

  // Create keypair based on scheme
  let keypair;
  switch (scheme) {
    case 'ED25519':
      keypair = Ed25519Keypair.fromSecretKey(privateKey);
      break;
    case 'Secp256k1':
      keypair = Secp256k1Keypair.fromSecretKey(privateKey);
      break;
    case 'Secp256r1':
      keypair = Secp256r1Keypair.fromSecretKey(privateKey);
      break;
    default:
      throw new Error(`Unsupported key scheme: ${scheme}`);
  }

  const signerAddress = keypair.getPublicKey().toSuiAddress();
  console.log(`Signer address: ${signerAddress}`);

  // Sign the transaction - returns SignatureWithBytes object
  const signatureWithBytes = await keypair.signTransaction(txBytes);
  // Extract the actual signature bytes from the object
  const signatureBase64 = signatureWithBytes.signature;

  console.log(`\n✅ Transaction signed successfully!`);

  // Save signature to file
  const signatureData = {
    signerIndex,
    signerAddress,
    publicKey: keypair.getPublicKey().toBase64(),
    signature: signatureBase64,
    scheme,
    signedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, 'signatures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `signature-${signerIndex}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(signatureData, null, 2));

  console.log(`📄 Signature saved to: ${outputPath}`);
  console.log(`\nNext steps:`);
  console.log(`1. Share this signature file with the transaction coordinator`);
  console.log(`2. Wait for other signers to complete their signatures`);
  console.log(`3. The coordinator will run combineAndSubmit.ts to execute the transaction`);
}

main().catch(console.error);
