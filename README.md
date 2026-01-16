# Poll Drop

A decentralized polling platform built on Sui blockchain with stake-to-vote mechanics and winner-takes-all reward distribution. Sui object-orientation and move language enable a trustless and transparent polling platform.

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


## Security Considerations

- **Creator Cannot Vote**: Prevents self-dealing
- **One Vote Per Address**: Prevents double voting
- **Time-Locked Finalization**: Can only finalize after expiry
- **Claim Once**: Winners can only claim rewards once
- **Platform Fee First**: Fee collected before any winner claims

