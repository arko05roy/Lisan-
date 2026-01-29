use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use lisan_contracts::private_voting::{
    IPrivateVotingDispatcher, IPrivateVotingDispatcherTrait, RevealedVote,
};
use lisan_contracts::commitment::{compute_vote_commitment, compute_nullifier_hash};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn USER2() -> ContractAddress {
    0x3.try_into().unwrap()
}

fn USER3() -> ContractAddress {
    0x4.try_into().unwrap()
}

fn USER4() -> ContractAddress {
    0x5.try_into().unwrap()
}

/// Deploy PrivateVoting contract (no constructor args).
fn setup() -> ContractAddress {
    let class = declare("PrivateVoting").unwrap().contract_class();
    let (address, _) = class.deploy(@array![]).unwrap();
    address
}

/// Setup + create a 3-option proposal (end_time = 1000).
fn setup_with_proposal() -> (ContractAddress, u64) {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create a 3-option proposal: "Best approach? A(0), B(1), C(2)"
    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xABC, 3, 1000);
    stop_cheat_caller_address(voting_address);

    (voting_address, proposal_id)
}

/// Setup + proposal + 3 votes cast (USER1→0, USER2→1, USER3→0).
/// Returns (voting_address, proposal_id).
fn setup_with_votes() -> (ContractAddress, u64) {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // USER1 votes for choice 0
    let c1 = compute_vote_commitment(0, 111, 222);
    let nh1 = compute_nullifier_hash(222);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh1);
    stop_cheat_caller_address(voting_address);

    // USER2 votes for choice 1
    let c2 = compute_vote_commitment(1, 333, 444);
    let nh2 = compute_nullifier_hash(444);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, c2, nh2);
    stop_cheat_caller_address(voting_address);

    // USER3 votes for choice 0
    let c3 = compute_vote_commitment(0, 555, 666);
    let nh3 = compute_nullifier_hash(666);
    start_cheat_caller_address(voting_address, USER3());
    voting.cast_vote(proposal_id, c3, nh3);
    stop_cheat_caller_address(voting_address);

    (voting_address, proposal_id)
}

/// Setup + proposal + votes + tally.
fn setup_tallied() -> (ContractAddress, u64) {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);
    let c2 = compute_vote_commitment(1, 333, 444);
    let c3 = compute_vote_commitment(0, 555, 666);

    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 333, nullifier_secret: 444 },
        RevealedVote { vote_commitment: c3, choice: 0, secret: 555, nullifier_secret: 666 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    (voting_address, proposal_id)
}


// ============================================================
// PROPOSAL CREATION TESTS
// ============================================================

#[test]
fn test_create_proposal() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let description_hash: felt252 = 0xABC;
    let num_options: felt252 = 3;
    let end_time: u64 = 1000;

    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(description_hash, num_options, end_time);
    stop_cheat_caller_address(voting_address);

    assert!(proposal_id == 0, "First proposal ID should be 0");
    assert!(voting.get_proposal_count() == 1, "Proposal count should be 1");
    assert!(
        voting.get_proposal_description(0) == description_hash, "Description hash mismatch",
    );
    assert!(voting.get_proposal_num_options(0) == num_options, "Num options mismatch");
    assert!(voting.get_proposal_end_time(0) == end_time, "End time mismatch");
    assert!(!voting.is_proposal_tallied(0), "Proposal should not be tallied");
    assert!(voting.get_proposal_vote_count(0) == 0, "Vote count should be 0");
}

#[test]
fn test_create_multiple_proposals() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    start_cheat_caller_address(voting_address, OWNER());
    let id_0 = voting.create_proposal(0xAAA, 2, 1000);
    let id_1 = voting.create_proposal(0xBBB, 3, 2000);
    let id_2 = voting.create_proposal(0xCCC, 5, 3000);
    stop_cheat_caller_address(voting_address);

    assert!(id_0 == 0, "First ID should be 0");
    assert!(id_1 == 1, "Second ID should be 1");
    assert!(id_2 == 2, "Third ID should be 2");
    assert!(voting.get_proposal_count() == 3, "Count should be 3");

    assert!(voting.get_proposal_description(0) == 0xAAA, "Proposal 0 desc mismatch");
    assert!(voting.get_proposal_description(1) == 0xBBB, "Proposal 1 desc mismatch");
    assert!(voting.get_proposal_description(2) == 0xCCC, "Proposal 2 desc mismatch");
    assert!(voting.get_proposal_num_options(0) == 2, "Proposal 0 options mismatch");
    assert!(voting.get_proposal_num_options(1) == 3, "Proposal 1 options mismatch");
    assert!(voting.get_proposal_num_options(2) == 5, "Proposal 2 options mismatch");
    assert!(voting.get_proposal_end_time(0) == 1000, "Proposal 0 end time mismatch");
    assert!(voting.get_proposal_end_time(1) == 2000, "Proposal 1 end time mismatch");
    assert!(voting.get_proposal_end_time(2) == 3000, "Proposal 2 end time mismatch");
}

#[test]
#[should_panic(expected: 'Need at least 2 options')]
fn test_create_proposal_zero_options() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    start_cheat_caller_address(voting_address, OWNER());
    voting.create_proposal(0xAAA, 0, 1000);
    stop_cheat_caller_address(voting_address);
}

#[test]
#[should_panic(expected: 'Need at least 2 options')]
fn test_create_proposal_one_option() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    start_cheat_caller_address(voting_address, OWNER());
    voting.create_proposal(0xAAA, 1, 1000);
    stop_cheat_caller_address(voting_address);
}

#[test]
#[should_panic(expected: 'End time must be in future')]
fn test_create_proposal_past_end_time() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Set current timestamp to 5000
    start_cheat_block_timestamp(voting_address, 5000);
    start_cheat_caller_address(voting_address, OWNER());
    voting.create_proposal(0xAAA, 2, 1000); // end_time 1000 < current 5000
    stop_cheat_caller_address(voting_address);
    stop_cheat_block_timestamp(voting_address);
}

#[test]
fn test_create_proposal_by_any_user() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Any user can create a proposal (permissionless)
    start_cheat_caller_address(voting_address, USER1());
    let id = voting.create_proposal(0xAAA, 2, 1000);
    stop_cheat_caller_address(voting_address);

    assert!(id == 0, "User1 should create proposal 0");
    assert!(voting.get_proposal_count() == 1, "Count should be 1");
}


// ============================================================
// CAST VOTE TESTS
// ============================================================

#[test]
fn test_cast_vote() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // USER1 votes for choice 0
    let choice: felt252 = 0;
    let secret: felt252 = 111;
    let nullifier_secret: felt252 = 222;
    let commitment = compute_vote_commitment(choice, secret, nullifier_secret);
    let nullifier_hash = compute_nullifier_hash(nullifier_secret);

    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, commitment, nullifier_hash);
    stop_cheat_caller_address(voting_address);

    // Verify vote was recorded
    assert!(voting.is_vote_commitment_used(commitment), "Vote commitment should exist");
    assert!(voting.get_proposal_vote_count(proposal_id) == 1, "Vote count should be 1");
    assert!(
        voting.is_nullifier_used_for_proposal(proposal_id, nullifier_hash),
        "Nullifier should be used for proposal",
    );
}

#[test]
fn test_cast_vote_multiple_voters() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Verify all 3 votes recorded
    assert!(voting.get_proposal_vote_count(proposal_id) == 3, "Vote count should be 3");

    let c1 = compute_vote_commitment(0, 111, 222);
    let c2 = compute_vote_commitment(1, 333, 444);
    let c3 = compute_vote_commitment(0, 555, 666);

    assert!(voting.is_vote_commitment_used(c1), "c1 should exist");
    assert!(voting.is_vote_commitment_used(c2), "c2 should exist");
    assert!(voting.is_vote_commitment_used(c3), "c3 should exist");
}

#[test]
#[should_panic(expected: 'Proposal does not exist')]
fn test_cast_vote_nonexistent_proposal() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let commitment = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);

    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(99, commitment, nh); // proposal 99 doesn't exist
    stop_cheat_caller_address(voting_address);
}

#[test]
#[should_panic(expected: 'Voting period ended')]
fn test_cast_vote_after_deadline() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let commitment = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);

    // Fast-forward past end_time (1000)
    start_cheat_block_timestamp(voting_address, 1001);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, commitment, nh);
    stop_cheat_caller_address(voting_address);
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Voting period ended')]
fn test_cast_vote_at_exact_end_time() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let commitment = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);

    // Exactly at end_time (1000) — current_time < end_time fails, so voting is closed
    start_cheat_block_timestamp(voting_address, 1000);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, commitment, nh);
    stop_cheat_caller_address(voting_address);
    stop_cheat_block_timestamp(voting_address);
}

#[test]
fn test_cast_vote_just_before_deadline() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let commitment = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);

    // At timestamp 999, voting should still be open (999 < 1000)
    start_cheat_block_timestamp(voting_address, 999);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, commitment, nh);
    stop_cheat_caller_address(voting_address);
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_vote_commitment_used(commitment), "Vote at 999 should succeed");
}

#[test]
#[should_panic(expected: 'Already tallied')]
fn test_cast_vote_after_tallied() {
    let (voting_address, proposal_id) = setup_tallied();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Try to vote after tally
    let commitment = compute_vote_commitment(2, 777, 888);
    let nh = compute_nullifier_hash(888);

    start_cheat_caller_address(voting_address, USER4());
    voting.cast_vote(proposal_id, commitment, nh);
    stop_cheat_caller_address(voting_address);
}

#[test]
#[should_panic(expected: 'Vote commitment exists')]
fn test_cast_vote_duplicate_commitment() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let commitment = compute_vote_commitment(0, 111, 222);
    let nh1 = compute_nullifier_hash(222);
    let nh2 = compute_nullifier_hash(333);

    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, commitment, nh1);
    stop_cheat_caller_address(voting_address);

    // Same commitment, different nullifier — should fail because commitment is globally unique
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, commitment, nh2);
    stop_cheat_caller_address(voting_address);
}

#[test]
#[should_panic(expected: 'Already voted on proposal')]
fn test_cast_vote_double_vote_same_proposal() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // USER1 votes once
    let c1 = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh);
    stop_cheat_caller_address(voting_address);

    // USER1 tries to vote again with same nullifier_hash (different commitment)
    let c2 = compute_vote_commitment(1, 333, 222); // same nullifier_secret=222 → same nullifier_hash
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c2, nh);
    stop_cheat_caller_address(voting_address);
}

#[test]
fn test_cast_vote_same_voter_different_proposals() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create two proposals
    start_cheat_caller_address(voting_address, OWNER());
    let p0 = voting.create_proposal(0xAAA, 2, 1000);
    let p1 = voting.create_proposal(0xBBB, 2, 2000);
    stop_cheat_caller_address(voting_address);

    // USER1 votes on proposal 0
    let c1 = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(p0, c1, nh);
    stop_cheat_caller_address(voting_address);

    // USER1 votes on proposal 1 with SAME nullifier (per-proposal nullifier allows this)
    // Need a different commitment since commitments are globally unique
    let c2 = compute_vote_commitment(1, 333, 222); // different secret, same nullifier_secret
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(p1, c2, nh);
    stop_cheat_caller_address(voting_address);

    assert!(voting.get_proposal_vote_count(p0) == 1, "Proposal 0 should have 1 vote");
    assert!(voting.get_proposal_vote_count(p1) == 1, "Proposal 1 should have 1 vote");
    assert!(
        voting.is_nullifier_used_for_proposal(p0, nh), "Nullifier should be used on proposal 0",
    );
    assert!(
        voting.is_nullifier_used_for_proposal(p1, nh), "Nullifier should be used on proposal 1",
    );
}


// ============================================================
// TALLY TESTS
// ============================================================

#[test]
fn test_tally_basic() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // 3 votes: choice 0 (x2), choice 1 (x1)
    let c1 = compute_vote_commitment(0, 111, 222);
    let c2 = compute_vote_commitment(1, 333, 444);
    let c3 = compute_vote_commitment(0, 555, 666);

    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 333, nullifier_secret: 444 },
        RevealedVote { vote_commitment: c3, choice: 0, secret: 555, nullifier_secret: 666 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(proposal_id), "Proposal should be tallied");
    assert!(voting.get_tally_result(proposal_id, 0) == 2, "Choice 0 should have 2 votes");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 should have 1 vote");
    assert!(voting.get_tally_result(proposal_id, 2) == 0, "Choice 2 should have 0 votes");
    assert!(voting.get_winning_option(proposal_id) == 0, "Winning option should be 0");
}

#[test]
#[should_panic(expected: 'Voting not ended yet')]
fn test_tally_before_deadline() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
    ];

    // Timestamp 500 < end_time 1000
    start_cheat_block_timestamp(voting_address, 500);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Already tallied')]
fn test_tally_already_tallied() {
    let (voting_address, proposal_id) = setup_tallied();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Try to tally again
    start_cheat_block_timestamp(voting_address, 2000);
    voting.tally(proposal_id, array![].span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Invalid vote reveal')]
fn test_tally_invalid_reveal_wrong_secret() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);

    // Wrong secret: 999 instead of 111
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 999, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Invalid vote reveal')]
fn test_tally_invalid_reveal_wrong_choice() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);

    // Wrong choice: 1 instead of 0
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 1, secret: 111, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Invalid vote reveal')]
fn test_tally_invalid_reveal_wrong_nullifier() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);

    // Wrong nullifier_secret: 999 instead of 222
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 999 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Vote not for this proposal')]
fn test_tally_vote_wrong_proposal() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create two proposals
    start_cheat_caller_address(voting_address, OWNER());
    let p0 = voting.create_proposal(0xAAA, 2, 1000);
    let p1 = voting.create_proposal(0xBBB, 2, 2000);
    stop_cheat_caller_address(voting_address);

    // Vote on proposal 0
    let c = compute_vote_commitment(0, 111, 222);
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(p0, c, nh);
    stop_cheat_caller_address(voting_address);

    // Try to tally proposal 1 with a vote from proposal 0
    let revealed = array![
        RevealedVote { vote_commitment: c, choice: 0, secret: 111, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 2000);
    voting.tally(p1, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Invalid choice')]
fn test_tally_invalid_choice_out_of_range() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Cast a vote with choice = 5 (num_options is 3, so choices are 0,1,2)
    // The commitment doesn't validate choice during cast, only during tally
    let c = compute_vote_commitment(5, 111, 222);
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c, nh);
    stop_cheat_caller_address(voting_address);

    // Tally — should fail because choice 5 >= 3 options
    let revealed = array![
        RevealedVote { vote_commitment: c, choice: 5, secret: 111, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
fn test_tally_no_votes_empty_span() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // No votes cast. Tally with empty span.
    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, array![].span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(proposal_id), "Should be tallied even with no votes");
    assert!(voting.get_tally_result(proposal_id, 0) == 0, "Choice 0 should have 0 votes");
    assert!(voting.get_tally_result(proposal_id, 1) == 0, "Choice 1 should have 0 votes");
    // Winning option defaults to 0 (first checked, tied at 0)
    assert!(voting.get_winning_option(proposal_id) == 0, "Default winning option should be 0");
}

#[test]
#[should_panic(expected: 'Duplicate revealed vote')]
fn test_tally_duplicate_revealed_vote() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);

    // Same vote revealed twice in the batch
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Proposal does not exist')]
fn test_tally_nonexistent_proposal() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(99, array![].span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
fn test_tally_partial_reveal() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // 3 votes were cast, but only 2 are revealed
    let c1 = compute_vote_commitment(0, 111, 222);
    let c2 = compute_vote_commitment(1, 333, 444);
    // c3 (USER3's vote for choice 0) is NOT revealed

    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 333, nullifier_secret: 444 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(proposal_id), "Should be tallied");
    assert!(voting.get_tally_result(proposal_id, 0) == 1, "Choice 0 should have 1 (partial)");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 should have 1");
    // Tie between 0 and 1, both have 1 vote. Option 0 wins (lower index with max found first)
    assert!(voting.get_winning_option(proposal_id) == 0, "Tied winner should be option 0");
}

#[test]
fn test_tally_at_exact_end_time() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Tally exactly at end_time (current_time >= end_time)
    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, array![].span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(proposal_id), "Should tally at exact end time");
}

#[test]
#[should_panic(expected: 'Vote commitment not found')]
fn test_tally_nonexistent_commitment() {
    let (voting_address, proposal_id) = setup_with_proposal();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Fabricate a reveal for a vote that was never cast
    let fake_c = compute_vote_commitment(0, 999, 888);
    let revealed = array![
        RevealedVote { vote_commitment: fake_c, choice: 0, secret: 999, nullifier_secret: 888 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}

#[test]
#[should_panic(expected: 'Nullifier mismatch')]
fn test_tally_nullifier_mismatch() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xABC, 3, 1000);
    stop_cheat_caller_address(voting_address);

    // Cast vote with nullifier_hash from nullifier_secret 222
    // But commitment uses nullifier_secret 222
    // Then during reveal, provide nullifier_secret 999 — commitment check passes only
    // if we also change secret. Actually this won't work because the commitment check comes first.
    // Let me construct a case where commitment matches but nullifier doesn't.
    //
    // This requires: commitment binds (choice, secret, nullifier_secret)
    // So we vote with commitment = Poseidon(0, 111, 222) and provide nh = Poseidon(999)
    // During tally: reveal (choice=0, secret=111, ns=222) — commitment matches,
    // but compute_nullifier_hash(222) != stored nh (which was Poseidon(999))
    let commitment = compute_vote_commitment(0, 111, 222);
    let fake_nh = compute_nullifier_hash(999); // Provide fake nullifier_hash during voting

    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, commitment, fake_nh);
    stop_cheat_caller_address(voting_address);

    // Reveal with true nullifier_secret (222) — commitment matches, but nullifier_hash mismatches
    let revealed = array![
        RevealedVote { vote_commitment: commitment, choice: 0, secret: 111, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);
}


// ============================================================
// TIE AND MULTI-OPTION TESTS
// ============================================================

#[test]
fn test_tally_tie_resolution() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create a binary proposal
    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xDEAD, 2, 1000);
    stop_cheat_caller_address(voting_address);

    // USER1 votes choice 0
    let c1 = compute_vote_commitment(0, 11, 22);
    let nh1 = compute_nullifier_hash(22);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh1);
    stop_cheat_caller_address(voting_address);

    // USER2 votes choice 1
    let c2 = compute_vote_commitment(1, 33, 44);
    let nh2 = compute_nullifier_hash(44);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, c2, nh2);
    stop_cheat_caller_address(voting_address);

    // Both revealed → tie (1 vote each)
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 11, nullifier_secret: 22 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 33, nullifier_secret: 44 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.get_tally_result(proposal_id, 0) == 1, "Choice 0 should have 1 vote");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 should have 1 vote");
    // Tie: first option with max votes wins (option 0 found first)
    assert!(voting.get_winning_option(proposal_id) == 0, "Tie should be won by lowest index (0)");
}

#[test]
fn test_five_option_proposal() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create 5-option proposal
    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xF15E, 5, 1000);
    stop_cheat_caller_address(voting_address);

    // USER1 votes choice 3
    let c1 = compute_vote_commitment(3, 11, 22);
    let nh1 = compute_nullifier_hash(22);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh1);
    stop_cheat_caller_address(voting_address);

    // USER2 votes choice 3
    let c2 = compute_vote_commitment(3, 33, 44);
    let nh2 = compute_nullifier_hash(44);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, c2, nh2);
    stop_cheat_caller_address(voting_address);

    // USER3 votes choice 1
    let c3 = compute_vote_commitment(1, 55, 66);
    let nh3 = compute_nullifier_hash(66);
    start_cheat_caller_address(voting_address, USER3());
    voting.cast_vote(proposal_id, c3, nh3);
    stop_cheat_caller_address(voting_address);

    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 3, secret: 11, nullifier_secret: 22 },
        RevealedVote { vote_commitment: c2, choice: 3, secret: 33, nullifier_secret: 44 },
        RevealedVote { vote_commitment: c3, choice: 1, secret: 55, nullifier_secret: 66 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.get_tally_result(proposal_id, 0) == 0, "Choice 0 should have 0");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 should have 1");
    assert!(voting.get_tally_result(proposal_id, 2) == 0, "Choice 2 should have 0");
    assert!(voting.get_tally_result(proposal_id, 3) == 2, "Choice 3 should have 2");
    assert!(voting.get_tally_result(proposal_id, 4) == 0, "Choice 4 should have 0");
    assert!(voting.get_winning_option(proposal_id) == 3, "Winner should be choice 3");
}


// ============================================================
// INTEGRATION / FULL FLOW TESTS
// ============================================================

#[test]
fn test_full_flow_binary_vote() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Step 1: Create proposal
    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xB10A12, 2, 5000);
    stop_cheat_caller_address(voting_address);
    assert!(proposal_id == 0, "Proposal ID should be 0");

    // Step 2: Cast votes
    // USER1 votes YES (0)
    let c1 = compute_vote_commitment(0, 100, 200);
    let nh1 = compute_nullifier_hash(200);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh1);
    stop_cheat_caller_address(voting_address);

    // USER2 votes NO (1)
    let c2 = compute_vote_commitment(1, 300, 400);
    let nh2 = compute_nullifier_hash(400);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, c2, nh2);
    stop_cheat_caller_address(voting_address);

    // USER3 votes YES (0)
    let c3 = compute_vote_commitment(0, 500, 600);
    let nh3 = compute_nullifier_hash(600);
    start_cheat_caller_address(voting_address, USER3());
    voting.cast_vote(proposal_id, c3, nh3);
    stop_cheat_caller_address(voting_address);

    assert!(voting.get_proposal_vote_count(proposal_id) == 3, "Should have 3 votes");

    // Step 3: Tally after end_time
    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 100, nullifier_secret: 200 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 300, nullifier_secret: 400 },
        RevealedVote { vote_commitment: c3, choice: 0, secret: 500, nullifier_secret: 600 },
    ];

    start_cheat_block_timestamp(voting_address, 5000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    // Step 4: Verify results
    assert!(voting.is_proposal_tallied(proposal_id), "Should be tallied");
    assert!(voting.get_tally_result(proposal_id, 0) == 2, "YES should have 2 votes");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "NO should have 1 vote");
    assert!(voting.get_winning_option(proposal_id) == 0, "YES (0) should win");
}

#[test]
fn test_multiple_proposals_independent() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create two proposals
    start_cheat_caller_address(voting_address, OWNER());
    let p0 = voting.create_proposal(0xAAA, 2, 1000);
    let p1 = voting.create_proposal(0xBBB, 3, 2000);
    stop_cheat_caller_address(voting_address);

    // Vote on proposal 0
    let c0 = compute_vote_commitment(0, 11, 22);
    let nh0 = compute_nullifier_hash(22);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(p0, c0, nh0);
    stop_cheat_caller_address(voting_address);

    // Vote on proposal 1
    let c1 = compute_vote_commitment(2, 33, 44);
    let nh1 = compute_nullifier_hash(44);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(p1, c1, nh1);
    stop_cheat_caller_address(voting_address);

    // Tally proposal 0 only
    let revealed_0 = array![
        RevealedVote { vote_commitment: c0, choice: 0, secret: 11, nullifier_secret: 22 },
    ];
    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(p0, revealed_0.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(p0), "Proposal 0 should be tallied");
    assert!(!voting.is_proposal_tallied(p1), "Proposal 1 should NOT be tallied yet");
    assert!(voting.get_proposal_vote_count(p1) == 1, "Proposal 1 should still have 1 vote");

    // Tally proposal 1
    let revealed_1 = array![
        RevealedVote { vote_commitment: c1, choice: 2, secret: 33, nullifier_secret: 44 },
    ];
    start_cheat_block_timestamp(voting_address, 2000);
    voting.tally(p1, revealed_1.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(p1), "Proposal 1 should now be tallied");
    assert!(voting.get_winning_option(p0) == 0, "Proposal 0 winner should be 0");
    assert!(voting.get_winning_option(p1) == 2, "Proposal 1 winner should be 2");
}

#[test]
fn test_anyone_can_tally() {
    let (voting_address, proposal_id) = setup_with_votes();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    let c1 = compute_vote_commitment(0, 111, 222);
    let c2 = compute_vote_commitment(1, 333, 444);
    let c3 = compute_vote_commitment(0, 555, 666);

    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 111, nullifier_secret: 222 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 333, nullifier_secret: 444 },
        RevealedVote { vote_commitment: c3, choice: 0, secret: 555, nullifier_secret: 666 },
    ];

    // USER4 (who didn't vote) triggers tally — trustless
    start_cheat_block_timestamp(voting_address, 1000);
    start_cheat_caller_address(voting_address, USER4());
    voting.tally(proposal_id, revealed.span());
    stop_cheat_caller_address(voting_address);
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.is_proposal_tallied(proposal_id), "Anyone should be able to trigger tally");
    assert!(voting.get_winning_option(proposal_id) == 0, "Result should still be correct");
}

#[test]
fn test_commitment_privacy() {
    // Different secrets produce different commitments — votes are hidden
    let c1 = compute_vote_commitment(0, 111, 222);
    let c2 = compute_vote_commitment(0, 111, 333); // different nullifier_secret
    let c3 = compute_vote_commitment(1, 111, 222); // different choice
    let c4 = compute_vote_commitment(0, 999, 222); // different secret

    assert!(c1 != c2, "Different nullifier_secret should produce different commitments");
    assert!(c1 != c3, "Different choices should produce different commitments");
    assert!(c1 != c4, "Different secrets should produce different commitments");
}

#[test]
fn test_view_functions_defaults() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    assert!(voting.get_proposal_count() == 0, "Initial proposal count should be 0");

    // Non-existent commitment checks
    let fake_commitment: felt252 = 0xDEAD;
    assert!(
        !voting.is_vote_commitment_used(fake_commitment),
        "Non-existent commitment should return false",
    );

    // Non-existent nullifier check
    let fake_nh: felt252 = 0xBEEF;
    assert!(
        !voting.is_nullifier_used_for_proposal(0, fake_nh),
        "Unused nullifier should return false",
    );
}

#[test]
fn test_votes_not_revealed_not_counted() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Create proposal
    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xABC, 2, 1000);
    stop_cheat_caller_address(voting_address);

    // Cast 3 votes (2 for choice 0, 1 for choice 1)
    let c1 = compute_vote_commitment(0, 11, 22);
    let nh1 = compute_nullifier_hash(22);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh1);
    stop_cheat_caller_address(voting_address);

    let c2 = compute_vote_commitment(1, 33, 44);
    let nh2 = compute_nullifier_hash(44);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, c2, nh2);
    stop_cheat_caller_address(voting_address);

    let c3 = compute_vote_commitment(0, 55, 66);
    let nh3 = compute_nullifier_hash(66);
    start_cheat_caller_address(voting_address, USER3());
    voting.cast_vote(proposal_id, c3, nh3);
    stop_cheat_caller_address(voting_address);

    assert!(voting.get_proposal_vote_count(proposal_id) == 3, "3 votes cast");

    // Only reveal the choice-1 vote (not the two choice-0 votes)
    let revealed = array![
        RevealedVote { vote_commitment: c2, choice: 1, secret: 33, nullifier_secret: 44 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    // Only 1 vote counted, and it was for choice 1
    assert!(voting.get_tally_result(proposal_id, 0) == 0, "Choice 0 not revealed = 0 counted");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 revealed = 1 counted");
    assert!(voting.get_winning_option(proposal_id) == 1, "Choice 1 wins (only one revealed)");
}

#[test]
fn test_large_voter_count() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xB16, 2, 1000);
    stop_cheat_caller_address(voting_address);

    // Cast 4 votes: 3 for choice 0, 1 for choice 1
    let c1 = compute_vote_commitment(0, 10, 20);
    let nh1 = compute_nullifier_hash(20);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c1, nh1);
    stop_cheat_caller_address(voting_address);

    let c2 = compute_vote_commitment(1, 30, 40);
    let nh2 = compute_nullifier_hash(40);
    start_cheat_caller_address(voting_address, USER2());
    voting.cast_vote(proposal_id, c2, nh2);
    stop_cheat_caller_address(voting_address);

    let c3 = compute_vote_commitment(0, 50, 60);
    let nh3 = compute_nullifier_hash(60);
    start_cheat_caller_address(voting_address, USER3());
    voting.cast_vote(proposal_id, c3, nh3);
    stop_cheat_caller_address(voting_address);

    let c4 = compute_vote_commitment(0, 70, 80);
    let nh4 = compute_nullifier_hash(80);
    start_cheat_caller_address(voting_address, USER4());
    voting.cast_vote(proposal_id, c4, nh4);
    stop_cheat_caller_address(voting_address);

    assert!(voting.get_proposal_vote_count(proposal_id) == 4, "Should have 4 votes");

    let revealed = array![
        RevealedVote { vote_commitment: c1, choice: 0, secret: 10, nullifier_secret: 20 },
        RevealedVote { vote_commitment: c2, choice: 1, secret: 30, nullifier_secret: 40 },
        RevealedVote { vote_commitment: c3, choice: 0, secret: 50, nullifier_secret: 60 },
        RevealedVote { vote_commitment: c4, choice: 0, secret: 70, nullifier_secret: 80 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.get_tally_result(proposal_id, 0) == 3, "Choice 0 should have 3 votes");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 should have 1 vote");
    assert!(voting.get_winning_option(proposal_id) == 0, "Choice 0 should win");
}

#[test]
fn test_tally_single_vote_single_option_winner() {
    let voting_address = setup();
    let voting = IPrivateVotingDispatcher { contract_address: voting_address };

    // Binary proposal
    start_cheat_caller_address(voting_address, OWNER());
    let proposal_id = voting.create_proposal(0xABC, 2, 1000);
    stop_cheat_caller_address(voting_address);

    // Only one voter, votes choice 1
    let c = compute_vote_commitment(1, 111, 222);
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(voting_address, USER1());
    voting.cast_vote(proposal_id, c, nh);
    stop_cheat_caller_address(voting_address);

    let revealed = array![
        RevealedVote { vote_commitment: c, choice: 1, secret: 111, nullifier_secret: 222 },
    ];

    start_cheat_block_timestamp(voting_address, 1000);
    voting.tally(proposal_id, revealed.span());
    stop_cheat_block_timestamp(voting_address);

    assert!(voting.get_tally_result(proposal_id, 0) == 0, "Choice 0 should have 0");
    assert!(voting.get_tally_result(proposal_id, 1) == 1, "Choice 1 should have 1");
    assert!(voting.get_winning_option(proposal_id) == 1, "Winner should be choice 1");
}
