# Multisig Workflow

This directory contains scripts for managing multisig transactions on Sui.

## Overview

The multisig workflow consists of 4 steps:

1. **Setup** - Create a multisig address from multiple public keys
2. **Prepare** - Build an unsigned transaction (using `prepareMultisigTx`)
3. **Sign** - Each signer signs the transaction individually
4. **Combine & Submit** - Combine signatures and execute the transaction

## Scripts

### 1. `setupMultisig.ts` - Create Multisig Address

Creates a multisig address from multiple public keys with a specified threshold.

**Usage:**

```bash
npm run setup-multisig -- --threshold 2 \
  --pk1 <public-key-1> \
  --pk2 <public-key-2> \
  --pk3 <public-key-3>
```

**Example (2-of-3 multisig):**

```bash
npm run setup-multisig -- --threshold 2 \
  --pk1 0x123... \
  --pk2 0x456... \
  --pk3 0x789...
```

**With custom weights:**

```bash
npm run setup-multisig -- --threshold 3 \
  --pk1 0x123... --weight 2 \
  --pk2 0x456... --weight 1 \
  --pk3 0x789... --weight 1
```

**Output:**

- Multisig address (fund this with SUI!)
- `multisig-config.json` - Configuration file for later use

---

### 2. Prepare Transaction

Use any script that calls `prepareMultisigTx` (e.g., `finalize.ts`):

```bash
npm run finalize -- --poll 0x... --gas 0x...
```

**Output:**

- `tx/tx-data.txt` - Unsigned transaction bytes (Base64)

---

### 3. `signMultisigTx.ts` - Sign Transaction

Each signer runs this to sign the prepared transaction.

**Usage:**

```bash
npm run sign-multisig -- --tx ../tx/tx-data.txt --pk <private-key> --index <signer-index>
```

**Example:**

```bash
# Signer 0
npm run sign-multisig -- --tx ../tx/tx-data.txt --pk <signer-0-private-key> --index 0

# Signer 1
npm run sign-multisig -- --tx ../tx/tx-data.txt --pk <signer-1-private-key> --index 1

# Signer 2
npm run sign-multisig -- --tx ../tx/tx-data.txt --pk <signer-2-private-key> --index 2
```

**Using environment variable:**

```bash
export SIGNER_PRIVATE_KEY=<your-private-key>
npm run sign-multisig -- --index 0
```

**Output:**

- `signatures/signature-<index>.json` - Individual signature file

---

### 4. `combineAndSubmit.ts` - Execute Transaction

Combines all signatures and submits the transaction to the network.

**Usage:**

```bash
npm run combine-submit -- --tx ../tx/tx-data.txt --network testnet
```

**Example:**

```bash
npm run combine-submit -- --network testnet
```

**Output:**

- Transaction digest and status
- Events emitted
- Object changes
- `last-tx-result.json` - Full transaction result

---

## Complete Workflow Example

### Step 1: Setup (One-time)

```bash
# Create 2-of-3 multisig
npm run setup-multisig -- --threshold 2 \
  --pk1 0xABC... \
  --pk2 0xDEF... \
  --pk3 0x123...

# Output: Multisig address: 0x456...
```

**Fund the multisig address:**

```bash
sui client transfer-sui --to 0x456... --amount 100000000 --gas-budget 10000000
```

**Update `constants.ts`:**

```typescript
export const adminCapOwner = {
  testnet: '0x456...', // Your multisig address
};
```

### Step 2: Prepare Transaction

```bash
npm run finalize -- --poll 0xPOLL_ID --gas 0xGAS_OBJECT
```

### Step 3: Collect Signatures

**Signer 0:**

```bash
npm run sign-multisig -- --pk <signer-0-pk> --index 0
```

**Signer 1:**

```bash
npm run sign-multisig -- --pk <signer-1-pk> --index 1
```

### Step 4: Submit

```bash
npm run combine-submit -- --network testnet
```

---

## File Structure

```
sig/
├── setupMultisig.ts           # Create multisig address
├── signMultisigTx.ts          # Individual signing
├── combineAndSubmit.ts        # Combine & submit
├── README.md                  # This file
├── multisig-config.json       # Generated: Multisig configuration
├── signatures/                # Generated: Individual signatures
│   ├── signature-0.json
│   ├── signature-1.json
│   └── signature-2.json
└── last-tx-result.json        # Generated: Last transaction result
```

---

## Key Concepts

### Threshold

The minimum weight required to execute a transaction.

**Example:** Threshold = 2

- Need signatures with combined weight ≥ 2
- If all signers have weight 1, need 2 signatures
- If one signer has weight 2, only need their signature

### Weights

Each signer can have a different weight (default: 1).

**Example:** 3 signers with weights [2, 1, 1] and threshold 3

- Signer 0 (weight 2) + Signer 1 (weight 1) = 3 ✅
- Signer 0 (weight 2) + Signer 2 (weight 1) = 3 ✅
- Signer 1 (weight 1) + Signer 2 (weight 1) = 2 ❌

### Key Schemes

Supported: `ED25519` (default), `Secp256k1`, `Secp256r1`

---

## Security Notes

⚠️ **Never share private keys!**

- Each signer keeps their private key secret
- Only share public keys during setup
- Only share signature files (not private keys) during signing

⚠️ **Verify transactions before signing!**

- Always inspect the transaction before signing
- Use `sui client dry-run` to simulate the transaction
- Verify the transaction matches what you expect

⚠️ **Backup your configuration!**

- Save `multisig-config.json` securely
- You'll need it to reconstruct the multisig for future transactions

---

## Troubleshooting

### "Insufficient signatures"

- Check that you have enough signatures to meet the threshold
- Verify signer indices match the configuration
- Ensure signature files are in `signatures/` directory

### "Transaction file not found"

- Verify the path to the transaction file
- Make sure you ran a prepare script (e.g., `finalize.ts`) first

### "Multisig config not found"

- Run `setupMultisig.ts` first to create the configuration
- Verify `multisig-config.json` exists in the `sig/` directory

### "Invalid Gas Object"

- Ensure the multisig address has SUI balance
- Verify the gas object ID is correct and owned by the multisig address
