module onchain::poll;

use std::option::{Self, Option};
use std::string::{Self, String};
use std::vector;
use sui::balance::{Self, Balance};
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
}
