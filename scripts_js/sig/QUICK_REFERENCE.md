# Multisig Quick Reference

## One-Time Setup

```bash
# 1. Create multisig address (2-of-3 example)
npm run setup-multisig -- --threshold 2 \
  --pk1 0xABC... \
  --pk2 0xDEF... \
  --pk3 0x123...

# 2. Fund the multisig address
sui client transfer-sui --to <multisig-address> --amount 100000000

# 3. Update constants.ts
# Set adminCapOwner[network] = <multisig-address>
```

## Transaction Workflow

### 1. Prepare Transaction

```bash
npm run finalize -- --poll 0x... --gas 0x...
# Output: tx/tx-data.txt
```

### 2. Collect Signatures

```bash
# Signer 0
npm run sign-multisig -- --pk <signer-0-pk> --index 0

# Signer 1
npm run sign-multisig -- --pk <signer-1-pk> --index 1

# Output: sig/signatures/signature-0.json, signature-1.json
```

### 3. Submit

```bash
npm run combine-submit -- --network testnet
# Output: Transaction digest and result
```

## File Locations

- **Config**: `sig/multisig-config.json` (created by setup)
- **Transaction**: `tx/tx-data.txt` (created by prepare)
- **Signatures**: `sig/signatures/signature-*.json` (created by signers)
- **Result**: `sig/last-tx-result.json` (created by submit)

## Common Commands

```bash
# Setup with custom weights
npm run setup-multisig -- --threshold 3 \
  --pk1 0x... --weight 2 \
  --pk2 0x... --weight 1 \
  --pk3 0x... --weight 1

# Sign with env var
export SIGNER_PRIVATE_KEY=<your-pk>
npm run sign-multisig -- --index 0

# Submit to mainnet
npm run combine-submit -- --network mainnet
```

## Troubleshooting

| Error                        | Solution                                  |
| ---------------------------- | ----------------------------------------- |
| "Insufficient signatures"    | Need more signers to meet threshold       |
| "Transaction file not found" | Run prepare script first (e.g., finalize) |
| "Multisig config not found"  | Run `setup-multisig` first                |
| "Invalid Gas Object"         | Fund multisig address with SUI            |

## Security Checklist

- [ ] Never share private keys
- [ ] Verify transaction before signing
- [ ] Backup multisig-config.json
- [ ] Use different keys for each signer
- [ ] Test on testnet first
