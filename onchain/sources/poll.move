module onchain::poll;

use onchain::utils::{init_votes, has_voted, has_claimed};
use std::option::{Self, Option};
use std::string::{Self, String};
use std::vector;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::sui::SUI;
use sui::transfer;

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
}

/// Creates a new poll with staking mechanism
public fun create_poll(
    options: vector<String>,
    expires_at: u64,
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
    });

    let poll = Poll {
        id,
        creator: creator_address,
        platform_treasury,
        expires_at,
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
