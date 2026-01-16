module onchain::poll;

use onchain::utils::{init_votes, has_voted, has_claimed, find_winning_option, find_voter_index};
use std::string::{ String};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;

const PLATFORM_FEE_PERCENT: u64 = 5;
const FEE_DENOMINATOR: u64 = 100;

const EOptionsEmpty: u64 = 1;
const EPollNotFound: u64 = 2;
const EPollExpired: u64 = 3;
const EPollOpen: u64 = 4;
const EVoteOutOfRange: u64 = 5;
const EAlreadyVoted: u64 = 6;
const ECreatorVote: u64 = 7;
const EInsufficientDeposit: u64 = 8;
const ENotWinner: u64 = 9;
const EAlreadyClaimed: u64 = 10;
const EPollNotFinalized: u64 = 11;
const ENoWinners: u64 = 12;
const EPollAlreadyFinalized: u64 = 13;
const EInvalidTreasuryAddress: u64 = 14;

/// Represents a single poll with voting data and staking pool
public struct Poll has key, store {
    id: UID,
    creator: address,
    platform_treasury: address,
    expires_at: u64,
    title: String,
    deposit_amount: u64,
    options: vector<String>,
    votes: vector<u64>,
    voters: vector<address>,
    vote_choices: vector<u64>,
    pool: Balance<SUI>,
    winning_option: Option<u64>,
    claimed: vector<address>,
    fee_collected: bool,
    timestamp: u64,
}

public struct PollEvent has copy, drop {
    id: ID,
    creator: address,
    title: String,
    expires_at: u64,
    deposit_amount: u64,
    timestamp: u64,
    options: vector<String>,
}

public struct VoteEvent has copy, drop {
    poll_id: ID,
    voter: address,
    option_index: u64,
    timestamp: u64,
}

public struct ClaimEvent has copy, drop {
    poll_id: ID,
    claimant: address,
    amount: u64,
    timestamp: u64,
}

public struct FinalizeEvent has copy, drop {
    poll_id: ID,
    winning_option: u64,
    winning_vote_count: u64,
    total_votes: u64,
    timestamp: u64,
}

/// Creates a new poll with staking mechanism
public fun create_poll(
    options: vector<String>,
    expires_at: u64,
    title: String,
    deposit_amount: u64,
    platform_treasury: address,
    creator_deposit: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(vector::length(&options) > 0, EOptionsEmpty);
    assert!(platform_treasury != @0x0, EInvalidTreasuryAddress);

    // Verify creator provided the deposit amount
    assert!(coin::value(&creator_deposit) >= deposit_amount, EInsufficientDeposit);

    let id = object::new(ctx);
    let creator_address = ctx.sender();
    let votes = init_votes(vector::length(&options));

    event::emit(PollEvent {
        id: id.to_inner(),
        creator: creator_address,
        title,
        expires_at,
        deposit_amount,
        timestamp: clock.timestamp_ms(),
        options,
    });

    let poll = Poll {
        id,
        creator: creator_address,
        platform_treasury,
        expires_at,
        title,
        deposit_amount,
        options,
        votes,
        voters: vector::empty(),
        vote_choices: vector::empty(),
        pool: coin::into_balance(creator_deposit),
        winning_option: option::none(),
        claimed: vector::empty(),
        fee_collected: false,
        timestamp: clock.timestamp_ms(),
    };

    transfer::share_object(poll);
}

/// Cast a vote for a poll option
public fun vote(
    poll: &mut Poll,
    vote_index: u64,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let sender = ctx.sender();
    
    // Checks
    assert!(clock.timestamp_ms() < poll.expires_at, EPollExpired);
    assert!(!has_user_voted(poll, sender), EAlreadyVoted);
    assert!(sender != poll.creator, ECreatorVote);
    assert!(vote_index < vector::length(&poll.options), EVoteOutOfRange);
    assert!(coin::value(&payment) >= poll.deposit_amount, EInsufficientDeposit);

    // Update state
    let current_votes = *vector::borrow(&poll.votes, vote_index);
    *vector::borrow_mut(&mut poll.votes, vote_index) = current_votes + 1;

    vector::push_back(&mut poll.voters, sender);
    vector::push_back(&mut poll.vote_choices, vote_index);
    balance::join(&mut poll.pool, coin::into_balance(payment));

    event::emit(VoteEvent {
        poll_id: object::id(poll),
        voter: sender,
        option_index: vote_index,
        timestamp: clock.timestamp_ms(),
    });
}

/// Finalize the poll and determine winner
public fun finalize(poll: &mut Poll, clock: &Clock, _ctx: &mut TxContext) {
    assert!(clock.timestamp_ms() >= poll.expires_at, EPollOpen);
    assert!(option::is_none(&poll.winning_option), EPollAlreadyFinalized);

    let winning_idx = find_winning_option(&poll.votes);
    poll.winning_option = option::some(winning_idx);

    let winning_vote_count = *vector::borrow(&poll.votes, winning_idx);
    let total_votes = vector::length(&poll.voters);

    event::emit(FinalizeEvent {
        poll_id: object::id(poll),
        winning_option: winning_idx,
        winning_vote_count,
        total_votes,
        timestamp: clock.timestamp_ms(),
    });
}

/// Claim reward for winning voters
public fun claim_reward(poll: &mut Poll, ctx: &mut TxContext) {
    assert!(option::is_some(&poll.winning_option), EPollNotFinalized);
    let sender = ctx.sender();
    assert!(!has_claimed(&poll.claimed, sender), EAlreadyClaimed);

    let winning_idx = *option::borrow(&poll.winning_option);
    
    // Check eligibility
    let voter_idx_opt = find_voter_index(&poll.voters, sender);
    assert!(option::is_some(&voter_idx_opt), ENotWinner);
    
    let v_idx = *option::borrow(&voter_idx_opt);
    let user_choice = *vector::borrow(&poll.vote_choices, v_idx);
    assert!(user_choice == winning_idx, ENotWinner);

    // Collect platform fee if not already collected
    if (!poll.fee_collected) {
        let total_balance = balance::value(&poll.pool);
        let fee_amt = (total_balance * PLATFORM_FEE_PERCENT) / FEE_DENOMINATOR;
        if (fee_amt > 0) {
            let fee_coin = coin::take(&mut poll.pool, fee_amt, ctx);
            transfer::public_transfer(fee_coin, poll.platform_treasury);
        };
        poll.fee_collected = true;
    };

    // Calculate reward based on remaining pool and remaining winners
    let total_winners = *vector::borrow(&poll.votes, winning_idx);
    let claimed_count = get_claimed_count(poll);
    let remaining_winners = total_winners - claimed_count;
    
    assert!(remaining_winners > 0, ENoWinners); // Should not happen if checks pass

    let reward_amt = balance::value(&poll.pool) / remaining_winners;
    let reward_coin = coin::take(&mut poll.pool, reward_amt, ctx);
    
    transfer::public_transfer(reward_coin, sender);
    vector::push_back(&mut poll.claimed, sender);

    event::emit(ClaimEvent {
        poll_id: object::id(poll),
        claimant: sender,
        amount: reward_amt,
        timestamp: ctx.epoch_timestamp_ms(), // Using ctx timestamp as approximation if clock not passed, or we can change signature.
        // Actually, let's use ctx.epoch_timestamp_ms() as it's sufficient for events if precise clock isn't needed for logic.
    });
}

// === accessor functions ===

/// Get poll creator
public fun get_creator(poll: &Poll): address {
    poll.creator
}

/// Get platform treasury address
public fun get_platform_treasury(poll: &Poll): address {
    poll.platform_treasury
}

/// Get poll expiry timestamp
public fun get_expires_at(poll: &Poll): u64 {
    poll.expires_at
}

/// Get required deposit amount
public fun get_deposit_amount(poll: &Poll): u64 {
    poll.deposit_amount
}

/// Get poll options
public fun get_options(poll: &Poll): vector<String> {
    poll.options
}

/// Get number of voters
public fun get_voter_count(poll: &Poll): u64 {
    vector::length(&poll.voters)
}

/// Check if address has voted
public fun has_user_voted(poll: &Poll, addr: address): bool {
    has_voted(&poll.voters, addr)
}

/// Get total pool size
public fun get_pool_size(poll: &Poll): u64 {
    balance::value(&poll.pool)
}

/// Get winning option (if finalized)
public fun get_winning_option(poll: &Poll): Option<u64> {
    poll.winning_option
}

/// Check if user has claimed winnings
public fun has_user_claimed(poll: &Poll, addr: address): bool {
    has_claimed(&poll.claimed, addr)
}

/// Get number of people who claimed
public fun get_claimed_count(poll: &Poll): u64 {
    vector::length(&poll.claimed)
}

/// Check if platform fee was collected
public fun is_fee_collected(poll: &Poll): bool {
    poll.fee_collected
}

/// Get platform fee percentage
public fun get_platform_fee_percent(): u64 {
    PLATFORM_FEE_PERCENT
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {}
