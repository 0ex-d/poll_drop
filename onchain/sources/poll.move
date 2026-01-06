module onchain::poll;

use std::option::{Self, Option};
use std::string::{Self, String};
use std::vector;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::sui::SUI;

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

fun new(
    platform_treasury: address,
    expires_at: u64,
    deposit_amount: u64,
    options: vector<String>,
    votes: vector<u64>,
    voters: vector<address>,
    vote_choices: vector<u64>,
    pool_deposit: Coin<SUI>,
    winning_option: Option<u64>,
    claimed: vector<address>,
    fee_collected: bool,
    timestamp: u64,
    ctx: &mut TxContext,
): Poll {
    let id = object::new(ctx);
    let creator_address = ctx.sender();

    event::emit(PollEvent {
        id: id.to_inner(),
        creator: creator_address,
    });

    Poll {
        id,
        creator: ctx.sender(),
        platform_treasury,
        expires_at,
        deposit_amount,
        options,
        votes,
        voters: vector::empty(),
        vote_choices: vector::empty(),
        pool: coin::into_balance(pool_deposit),
        winning_option: option::none(),
        claimed: vector::empty(),
        fee_collected: false,
        timestamp,
    }
}
