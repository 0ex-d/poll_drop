// SPDX-License-Identifier: MIT
// Copyright (c) 2026 0ex-d
module onchain::utils;

/// Initializes a zeroed vote vector
public(package) fun init_votes(option_count: u64): vector<u64> {
    let mut votes = vector::empty<u64>();
    let mut i = 0;
    while (i < option_count) {
        vector::push_back(&mut votes, 0);
        i = i + 1;
    };
    votes
}

/// Checks if address has already voted
public(package) fun has_voted(voters: &vector<address>, addr: address): bool {
    let len = vector::length(voters);
    let mut i = 0;
    while (i < len) {
        if (*vector::borrow(voters, i) == addr) {
            return true
        };
        i = i + 1;
    };
    false
}

/// Checks if address has already claimed
public(package) fun has_claimed(claimed: &vector<address>, addr: address): bool {
    let len = vector::length(claimed);
    let mut i = 0;
    while (i < len) {
        if (*vector::borrow(claimed, i) == addr) {
            return true
        };
        i = i + 1;
    };
    false
}

/// Finds the index of a voter in the voters list
public(package) fun find_voter_index(voters: &vector<address>, addr: address): Option<u64> {
    let len = vector::length(voters);
    let mut i = 0;
    while (i < len) {
        if (*vector::borrow(voters, i) == addr) {
            return option::some(i)
        };
        i = i + 1;
    };
    option::none()
}

/// Finds the winning option (highest vote count, first in case of tie)
public(package) fun find_winning_option(votes: &vector<u64>): u64 {
    let len = vector::length(votes);
    let mut max_votes = 0;
    let mut winning_idx = 0;
    let mut i = 0;

    while (i < len) {
        let vote_count = *vector::borrow(votes, i);
        if (vote_count > max_votes) {
            max_votes = vote_count;
            winning_idx = i;
        };
        i = i + 1;
    };

    winning_idx
}

/// Copies vote counts to a new vector
public(package) fun copy_votes(votes: &vector<u64>): vector<u64> {
    let mut out = vector::empty<u64>();
    let len = vector::length(votes);
    let mut i = 0;
    while (i < len) {
        vector::push_back(&mut out, *vector::borrow(votes, i));
        i = i + 1;
    };
    out
}
