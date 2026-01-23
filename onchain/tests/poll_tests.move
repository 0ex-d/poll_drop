// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d

#[test_only]
module onchain::poll_tests;

use onchain::poll::{Self, Poll};
use std::string;
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};

// Test addresses
const CREATOR: address = @0xA;
const VOTER1: address = @0xB;
const VOTER2: address = @0xC;
const VOTER3: address = @0xD;
const PLATFORM_TREASURY: address = @0xF;

// Test constants
const CURRENT_TIME: u64 = 1000;
const FUTURE_TIME: u64 = 2000;
const DEPOSIT_AMOUNT: u64 = 1000000; // 0.001 SUI in MIST

// Helper function to create test options
fun create_test_options(): vector<string::String> {
    let mut options = vector::empty();
    vector::push_back(&mut options, string::utf8(b"Option A"));
    vector::push_back(&mut options, string::utf8(b"Option B"));
    vector::push_back(&mut options, string::utf8(b"Option C"));
    options
}

// Helper to advance scenario and get clock
fun setup_clock(scenario: &mut Scenario, timestamp: u64): Clock {
    let mut clock = clock::create_for_testing(ts::ctx(scenario));
    clock::set_for_testing(&mut clock, timestamp * 1000); // Convert to ms
    clock
}

// Helper to create a coin with specific value
fun mint_coin(scenario: &mut Scenario, amount: u64): Coin<SUI> {
    coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))
}

#[test]
fun test_create_poll_with_deposit() {
    let mut scenario = ts::begin(CREATOR);

    let clock = setup_clock(&mut scenario, CURRENT_TIME);

    // Create poll with initial deposit
    ts::next_tx(&mut scenario, CREATOR);
    {
        let options = create_test_options();
        let deposit = mint_coin(&mut scenario, DEPOSIT_AMOUNT);
        let title = string::utf8(b"Title");
        poll::create_poll(
            options,
            FUTURE_TIME * 1000,
            title,
            DEPOSIT_AMOUNT,
            option::none(),
            PLATFORM_TREASURY,
            deposit,
            &clock,
            ts::ctx(&mut scenario),
        );
    };

    // Verify poll was created with correct parameters
    ts::next_tx(&mut scenario, CREATOR);
    {
        let poll = ts::take_shared<Poll>(&scenario);

        assert!(poll::get_creator(&poll) == CREATOR, 0);
        assert!(poll::get_platform_treasury(&poll) == PLATFORM_TREASURY, 1);
        assert!(poll::get_expires_at(&poll) == FUTURE_TIME * 1000, 2);
        assert!(poll::get_deposit_amount(&poll) == DEPOSIT_AMOUNT, 3);
        assert!(poll::get_pool_size(&poll) == DEPOSIT_AMOUNT, 4);
        assert!(poll::get_voter_count(&poll) == 0, 5);
        assert!(!poll::is_fee_collected(&poll), 6);

        clock::destroy_for_testing(clock);
        ts::return_shared(poll);
    };

    ts::end(scenario);
}

#[test]
fun test_create_poll_with_image() {
    let mut scenario = ts::begin(CREATOR);

    let clock = setup_clock(&mut scenario, CURRENT_TIME);

    // Create poll with initial deposit
    ts::next_tx(&mut scenario, CREATOR);
    {
        let options = create_test_options();
        let deposit = mint_coin(&mut scenario, DEPOSIT_AMOUNT);
        let title = string::utf8(b"Title");
        let image_blob_id = option::some(string::utf8(b"0x1234567890abcdef1234567890abcdef"));
        poll::create_poll(
            options,
            FUTURE_TIME * 1000,
            title,
            DEPOSIT_AMOUNT,
            image_blob_id,
            PLATFORM_TREASURY,
            deposit,
            &clock,
            ts::ctx(&mut scenario),
        );
    };

    // Verify poll was created with correct parameters
    ts::next_tx(&mut scenario, CREATOR);
    {
        let poll = ts::take_shared<Poll>(&scenario);

        assert!(poll::get_creator(&poll) == CREATOR, 0);
        assert!(poll::get_platform_treasury(&poll) == PLATFORM_TREASURY, 1);
        assert!(poll::get_expires_at(&poll) == FUTURE_TIME * 1000, 2);
        assert!(poll::get_deposit_amount(&poll) == DEPOSIT_AMOUNT, 3);
        assert!(poll::get_pool_size(&poll) == DEPOSIT_AMOUNT, 4);
        assert!(poll::get_voter_count(&poll) == 0, 5);
        assert!(!poll::is_fee_collected(&poll), 6);

        clock::destroy_for_testing(clock);
        ts::return_shared(poll);
    };

    ts::end(scenario);
}

#[test]
fun test_lifecycle_flow() {
    let mut scenario = ts::begin(CREATOR);
    let mut clock = setup_clock(&mut scenario, CURRENT_TIME);

    // 1. Create Poll
    ts::next_tx(&mut scenario, CREATOR);
    {
        let options = create_test_options();
        let deposit = mint_coin(&mut scenario, DEPOSIT_AMOUNT);
        let title = string::utf8(b"Title");
        poll::create_poll(
            options,
            FUTURE_TIME * 1000,
            title,
            DEPOSIT_AMOUNT,
            option::none(),
            PLATFORM_TREASURY,
            deposit,
            &clock,
            ts::ctx(&mut scenario),
        );
    };

    // 2. Voter 1 Votes for Option 0
    ts::next_tx(&mut scenario, VOTER1);
    {
        let mut poll = ts::take_shared<Poll>(&scenario);
        let payment = mint_coin(&mut scenario, DEPOSIT_AMOUNT);
        poll::vote(&mut poll, 0, payment, &clock, ts::ctx(&mut scenario));
        assert!(poll::get_voter_count(&poll) == 1, 0);
        assert!(poll::get_pool_size(&poll) == DEPOSIT_AMOUNT * 2, 1); // Creator + V1
        ts::return_shared(poll);
    };

    // 3. Voter 2 Votes for Option 0 (Winner team)
    ts::next_tx(&mut scenario, VOTER2);
    {
        let mut poll = ts::take_shared<Poll>(&scenario);
        let payment = mint_coin(&mut scenario, DEPOSIT_AMOUNT);
        poll::vote(&mut poll, 0, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(poll);
    };

    // 4. Voter 3 Votes for Option 1 (Loser team)
    ts::next_tx(&mut scenario, VOTER3);
    {
        let mut poll = ts::take_shared<Poll>(&scenario);
        let payment = mint_coin(&mut scenario, DEPOSIT_AMOUNT);
        poll::vote(&mut poll, 1, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(poll);
    };

    // 5. Advance time to expire poll
    clock::set_for_testing(&mut clock, (FUTURE_TIME + 1000) * 1000);

    // 6. Finalize
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut poll = ts::take_shared<Poll>(&scenario);
        poll::finalize(&mut poll, &clock, ts::ctx(&mut scenario));
        
        let winner = poll::get_winning_option(&poll);
        assert!(option::is_some(&winner), 2);
        assert!(*option::borrow(&winner) == 0, 3);
        
        ts::return_shared(poll);
    };

    // 7. Voter 1 Claims
    ts::next_tx(&mut scenario, VOTER1);
    {
        let mut poll = ts::take_shared<Poll>(&scenario);
        assert!(!poll::is_fee_collected(&poll), 4);
        
        poll::claim_reward(&mut poll, ts::ctx(&mut scenario));
        
        assert!(poll::is_fee_collected(&poll), 5);
        assert!(poll::has_user_claimed(&poll, VOTER1), 6);
        
        ts::return_shared(poll);
    };

    // 8. Voter 2 Claims
    ts::next_tx(&mut scenario, VOTER2);
    {
        let mut poll = ts::take_shared<Poll>(&scenario);
        poll::claim_reward(&mut poll, ts::ctx(&mut scenario));
        assert!(poll::has_user_claimed(&poll, VOTER2), 7);
        ts::return_shared(poll);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
