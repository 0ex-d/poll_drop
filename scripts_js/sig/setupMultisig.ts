// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

/**
 * Setup Multisig Address
 *
 * This script creates a multisig address from multiple public keys.
 * The multisig address can then be used as the sender for transactions
 * that require multiple signatures.
 *
 * Usage:
 *   npm run setup-multisig -- --threshold 2 --pk1 <pubkey1> --pk2 <pubkey2> --pk3 <pubkey3>
 *
 * Example:
 *   npm run setup-multisig -- --threshold 2 \
 *     --pk1 0x123... \
 *     --pk2 0x456... \
 *     --pk3 0x789...
 */

import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import fs from 'fs';
import path from 'path';

type KeyScheme = 'ED25519' | 'Secp256k1' | 'Secp256r1';

interface SignerConfig {
  publicKey: string;
  weight: number;
  scheme: KeyScheme;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse threshold
  const thresholdIdx = args.indexOf('--threshold');
  if (thresholdIdx === -1) {
    throw new Error('--threshold is required (e.g., --threshold 2)');
  }
  const threshold = parseInt(args[thresholdIdx + 1]);

  // Parse public keys
  const signers: SignerConfig[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Support --pk1, --pk2, --pk3, etc.
    if (arg.match(/^--pk\d+$/)) {
      const pubKey = args[i + 1];
      const weight = args[i + 2]?.startsWith('--weight') ? parseInt(args[i + 3]) : 1;
      const scheme = (args[i + 4]?.startsWith('--scheme') ? args[i + 5] : 'ED25519') as KeyScheme;

      signers.push({
        publicKey: pubKey,
        weight,
        scheme,
      });
    }
  }

  if (signers.length === 0) {
    throw new Error('At least one public key is required (e.g., --pk1 0x123...)');
  }

  console.log(`\n🔐 Creating Multisig Address`);
  console.log(`Threshold: ${threshold}`);
  console.log(`Signers: ${signers.length}\n`);

  // Create public key objects based on scheme
  const publicKeys = signers.map((signer, idx) => {
    console.log(`Signer ${idx + 1}:`);
    console.log(`  Public Key: ${signer.publicKey}`);
    console.log(`  Weight: ${signer.weight}`);
    console.log(`  Scheme: ${signer.scheme}`);

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

  // Create multisig public key
  const multisigPublicKey = MultiSigPublicKey.fromPublicKeys({
    threshold,
    publicKeys,
  });

  // Derive multisig address
  const multisigAddress = multisigPublicKey.toSuiAddress();

  console.log(`\n✅ Multisig Address Created!`);
  console.log(`Address: ${multisigAddress}\n`);

  // Save configuration to file
  const config = {
    multisigAddress,
    threshold,
    signers: signers.map((s, idx) => ({
      index: idx,
      publicKey: s.publicKey,
      weight: s.weight,
      scheme: s.scheme,
    })),
    createdAt: new Date().toISOString(),
  };

  const configPath = path.join(__dirname, 'multisig-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`📄 Configuration saved to: ${configPath}`);
  console.log(
    `\n⚠️  Important: Fund this address with SUI before using it as a transaction sender!`,
  );
  console.log(`\nNext steps:`);
  console.log(`1. Send SUI to: ${multisigAddress}`);
  console.log(`2. Update your constants.ts with this multisig address`);
  console.log(`3. Use prepareMultisigTx to create unsigned transactions`);
  console.log(`4. Have each signer run signMultisigTx.ts to sign`);
  console.log(`5. Run combineAndSubmit.ts to execute the transaction`);
}

main().catch(console.error);
