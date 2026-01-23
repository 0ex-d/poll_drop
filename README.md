# Poll Drop

A decentralized polling platform built on Sui blockchain with stake-to-vote mechanics and winner-takes-all reward distribution. Sui object-orientation and move language enable a trustless and transparent polling platform.

## Overview

Poll Drop allows users to create polls where participants stake SUI tokens to vote. After the poll expires, the winning option's voters split the entire prize pool (minus a 5% platform fee). This creates skin-in-the-game dynamics for more meaningful polling.

## Smart Contract Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           POLL LIFECYCLE                                 │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   CREATE     │  Creator stakes deposit + sets options & expiry
    │   POLL       │  Emits: PollEvent (with full poll details)
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   VOTING     │  Voters stake equal deposit to vote
    │   PHASE      │  - Cannot vote if expired
    │              │  - Creator cannot vote
    │              │  - Each address votes once
    │              │  Emits: VoteEvent (per vote)
    └──────┬───────┘
           │
           │ (Poll expires_at reached)
           │
           ▼
    ┌──────────────┐
    │  FINALIZE    │  Anyone can call after expiry
    │              │  - Determines winning option
    │              │  - Locks poll state
    │              │  Emits: FinalizeEvent (with vote counts)
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   CLAIM      │  Winners claim proportional rewards
    │   REWARDS    │  - 5% platform fee (first claim only)
    │              │  - Remaining pool split equally
    │              │  - Each winner claims once
    │              │  Emits: ClaimEvent (per claim)
    └──────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         REWARD DISTRIBUTION                              │
└─────────────────────────────────────────────────────────────────────────┘

    Total Pool = (Creator Deposit) + (All Voter Deposits)
                        │
                        ├─► 5% → Platform Treasury
                        │
                        └─► 95% → Split equally among winners

    Example:
    - 1 Creator + 3 Voters @ 0.1 SUI each = 0.4 SUI total
    - Platform Fee: 0.02 SUI
    - Winner Pool: 0.38 SUI
    - If 2 voters won: 0.19 SUI each
```

## Features

- **Stake-to-Vote**: Participants must stake SUI to vote, creating commitment
- **Winner-Takes-All**: Winning voters split the entire pool
- **Platform Fee**: 5% fee on total pool (collected on first claim)
- **Event-Driven**: Comprehensive events for indexing and UI updates
- **Time-Locked**: Polls expire at a specific timestamp
- **Fair Distribution**: Equal reward split among all winners

## Usage

### Create a Poll
```bash
cd scripts_js
npm run create-poll
```

### Vote on a Poll
```bash
npm run vote -- --poll <POLL_ID> --index <OPTION_INDEX>
```



## Security Considerations

- **Creator Cannot Vote**: Prevents self-dealing
- **One Vote Per Address**: Prevents double voting
- **Time-Locked Finalization**: Can only finalize after expiry
- **Claim Once**: Winners can only claim rewards once
- **Platform Fee First**: Fee collected before any winner claims

