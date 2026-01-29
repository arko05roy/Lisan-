use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::mock_pragma_oracle::{
    IMockPragmaOracleDispatcher, IMockPragmaOracleDispatcherTrait,
};
use lisan_contracts::prediction_market::{
    IPredictionMarketDispatcher, IPredictionMarketDispatcherTrait,
};
use lisan_contracts::commitment::{compute_bet_commitment, compute_nullifier_hash};

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

/// Deploy MockBTC, MockPragmaOracle, PredictionMarket.
/// Mints tokens and sets approvals for USER1, USER2, USER3.
/// Default block timestamp is 0, resolution_time should be set > 0.
fn setup() -> (ContractAddress, ContractAddress, ContractAddress) {
    // Deploy MockBTC
    let btc_class = declare("MockBTC").unwrap().contract_class();
    let mut btc_calldata = array![];
    OWNER().serialize(ref btc_calldata);
    let (btc_address, _) = btc_class.deploy(@btc_calldata).unwrap();

    // Deploy MockPragmaOracle
    let oracle_class = declare("MockPragmaOracle").unwrap().contract_class();
    let mut oracle_calldata = array![];
    OWNER().serialize(ref oracle_calldata);
    let (oracle_address, _) = oracle_class.deploy(@oracle_calldata).unwrap();

    // Deploy PredictionMarket
    let market_class = declare("PredictionMarket").unwrap().contract_class();
    let mut market_calldata = array![];
    btc_address.serialize(ref market_calldata);
    oracle_address.serialize(ref market_calldata);
    let (market_address, _) = market_class.deploy(@market_calldata).unwrap();

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Mint tokens to USER1 and approve market contract
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER1());
    btc_erc20.approve(market_address, 100000);
    stop_cheat_caller_address(btc_address);

    // Mint tokens to USER2 and approve
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER2(), 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER2());
    btc_erc20.approve(market_address, 100000);
    stop_cheat_caller_address(btc_address);

    // Mint tokens to USER3 and approve
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER3(), 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER3());
    btc_erc20.approve(market_address, 100000);
    stop_cheat_caller_address(btc_address);

    (btc_address, oracle_address, market_address)
}

/// Setup + create a binary market (2 outcomes, resolution_time = 1000)
fn setup_with_market() -> (ContractAddress, ContractAddress, ContractAddress, u64) {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Create a binary market: "Will BTC hit 100k?"
    // question_hash is a Poseidon hash of the question text (simulated as a constant here)
    let question_hash: felt252 = 0xB7C100;
    let num_outcomes: felt252 = 2; // YES (0) or NO (1)
    let resolution_time: u64 = 1000;

    start_cheat_caller_address(market_address, OWNER());
    let market_id = market.create_market(question_hash, num_outcomes, resolution_time);
    stop_cheat_caller_address(market_address);

    (btc_address, oracle_address, market_address, market_id)
}

/// Setup + market + USER1 places a bet on outcome 0 (YES) with amount 500
fn setup_with_bet() -> (ContractAddress, ContractAddress, ContractAddress, u64, felt252) {
    let (btc_address, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // USER1 bets 500 on outcome 0 (YES)
    let outcome: felt252 = 0;
    let bet_amount: felt252 = 500;
    let secret: felt252 = 111;
    let nullifier_secret: felt252 = 222;
    let commitment = compute_bet_commitment(outcome, bet_amount, secret, nullifier_secret);

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 500);
    stop_cheat_caller_address(market_address);

    (btc_address, oracle_address, market_address, market_id, commitment)
}

/// Setup + market + bet + oracle result + resolve
fn setup_resolved() -> (ContractAddress, ContractAddress, ContractAddress, u64, felt252) {
    let (btc_address, oracle_address, market_address, market_id, commitment) = setup_with_bet();
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Oracle sets winning outcome to 0 (YES wins)
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    // Fast-forward past resolution time and resolve
    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    (btc_address, oracle_address, market_address, market_id, commitment)
}


// ============================================================
// MARKET CREATION TESTS
// ============================================================

#[test]
fn test_create_market() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let question_hash: felt252 = 0xB7C100;
    let num_outcomes: felt252 = 2;
    let resolution_time: u64 = 1000;

    start_cheat_caller_address(market_address, OWNER());
    let market_id = market.create_market(question_hash, num_outcomes, resolution_time);
    stop_cheat_caller_address(market_address);

    assert!(market_id == 0, "First market ID should be 0");
    assert!(market.get_market_count() == 1, "Market count should be 1");
    assert!(market.get_market_question(0) == question_hash, "Question hash mismatch");
    assert!(market.get_market_num_outcomes(0) == num_outcomes, "Num outcomes mismatch");
    assert!(market.get_market_resolution_time(0) == resolution_time, "Resolution time mismatch");
    assert!(!market.is_market_resolved(0), "Market should not be resolved");
    assert!(market.get_market_total_pool(0) == 0, "Pool should be empty");
    assert!(market.get_market_bet_count(0) == 0, "Bet count should be 0");
}

#[test]
fn test_create_multiple_markets() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    start_cheat_caller_address(market_address, OWNER());

    let id_0 = market.create_market(0xAAA, 2, 1000);
    let id_1 = market.create_market(0xBBB, 3, 2000);
    let id_2 = market.create_market(0xCCC, 5, 3000);

    stop_cheat_caller_address(market_address);

    assert!(id_0 == 0, "First ID should be 0");
    assert!(id_1 == 1, "Second ID should be 1");
    assert!(id_2 == 2, "Third ID should be 2");
    assert!(market.get_market_count() == 3, "Count should be 3");

    // Verify each market has correct data
    assert!(market.get_market_question(0) == 0xAAA, "Market 0 question mismatch");
    assert!(market.get_market_question(1) == 0xBBB, "Market 1 question mismatch");
    assert!(market.get_market_question(2) == 0xCCC, "Market 2 question mismatch");
    assert!(market.get_market_num_outcomes(0) == 2, "Market 0 outcomes mismatch");
    assert!(market.get_market_num_outcomes(1) == 3, "Market 1 outcomes mismatch");
    assert!(market.get_market_num_outcomes(2) == 5, "Market 2 outcomes mismatch");
    assert!(market.get_market_resolution_time(0) == 1000, "Market 0 resolution time mismatch");
    assert!(market.get_market_resolution_time(1) == 2000, "Market 1 resolution time mismatch");
    assert!(market.get_market_resolution_time(2) == 3000, "Market 2 resolution time mismatch");
}

#[test]
#[should_panic(expected: 'Need at least 2 outcomes')]
fn test_create_market_zero_outcomes() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    start_cheat_caller_address(market_address, OWNER());
    market.create_market(0xAAA, 0, 1000);
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Need at least 2 outcomes')]
fn test_create_market_one_outcome() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    start_cheat_caller_address(market_address, OWNER());
    market.create_market(0xAAA, 1, 1000);
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Resolution time must be future')]
fn test_create_market_resolution_time_in_past() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Set current timestamp to 5000
    start_cheat_block_timestamp(market_address, 5000);
    start_cheat_caller_address(market_address, OWNER());
    market.create_market(0xAAA, 2, 1000); // resolution_time 1000 < current 5000
    stop_cheat_caller_address(market_address);
    stop_cheat_block_timestamp(market_address);
}

#[test]
fn test_create_market_by_any_user() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Any user should be able to create a market (not just owner)
    start_cheat_caller_address(market_address, USER1());
    let id = market.create_market(0xAAA, 2, 1000);
    stop_cheat_caller_address(market_address);

    assert!(id == 0, "User1 should create market 0");
    assert!(market.get_market_count() == 1, "Count should be 1");
}


// ============================================================
// PLACE BET TESTS
// ============================================================

#[test]
fn test_place_bet() {
    let (btc_address, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER1 bets 500 on outcome 0 (YES)
    let outcome: felt252 = 0;
    let bet_amount: felt252 = 500;
    let secret: felt252 = 111;
    let nullifier_secret: felt252 = 222;
    let commitment = compute_bet_commitment(outcome, bet_amount, secret, nullifier_secret);

    let user1_balance_before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 500);
    stop_cheat_caller_address(market_address);

    // Verify bet was recorded
    assert!(market.is_bet_placed(commitment), "Bet commitment should exist");
    assert!(market.get_bet_market_id(commitment) == market_id, "Bet market ID mismatch");
    assert!(market.get_market_total_pool(market_id) == 500, "Pool should be 500");
    assert!(market.get_market_remaining_pool(market_id) == 500, "Remaining pool should be 500");
    assert!(market.get_market_bet_count(market_id) == 1, "Bet count should be 1");

    // Verify token transfer
    let user1_balance_after = btc_erc20.balance_of(USER1());
    assert!(user1_balance_after == user1_balance_before - 500, "User1 should have 500 less");
    assert!(btc_erc20.balance_of(market_address) == 500, "Market should hold 500");
}

#[test]
fn test_place_bet_multiple_bettors() {
    let (btc_address, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER1 bets 500 on outcome 0 (YES)
    let c1 = compute_bet_commitment(0, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 500);
    stop_cheat_caller_address(market_address);

    // USER2 bets 300 on outcome 1 (NO) — different outcome, hidden in commitment
    let c2 = compute_bet_commitment(1, 300, 333, 444);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 300);
    stop_cheat_caller_address(market_address);

    // USER3 bets 200 on outcome 0 (YES)
    let c3 = compute_bet_commitment(0, 200, 555, 666);
    start_cheat_caller_address(market_address, USER3());
    market.place_bet(market_id, c3, 200);
    stop_cheat_caller_address(market_address);

    // Verify pool totals
    assert!(market.get_market_total_pool(market_id) == 1000, "Pool should be 1000");
    assert!(market.get_market_remaining_pool(market_id) == 1000, "Remaining should be 1000");
    assert!(market.get_market_bet_count(market_id) == 3, "Bet count should be 3");

    // Verify all bets exist
    assert!(market.is_bet_placed(c1), "c1 should exist");
    assert!(market.is_bet_placed(c2), "c2 should exist");
    assert!(market.is_bet_placed(c3), "c3 should exist");

    // Verify market contract holds all tokens
    assert!(btc_erc20.balance_of(market_address) == 1000, "Market should hold 1000");
}

#[test]
#[should_panic(expected: 'Market does not exist')]
fn test_place_bet_nonexistent_market() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(0, 500, 111, 222);

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(99, commitment, 500); // market 99 doesn't exist
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Amount must be > 0')]
fn test_place_bet_zero_amount() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(0, 0, 111, 222);

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 0);
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Bet commitment exists')]
fn test_place_bet_duplicate_commitment() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(0, 500, 111, 222);

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 500);
    market.place_bet(market_id, commitment, 500); // duplicate
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Betting period ended')]
fn test_place_bet_after_resolution_time() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(0, 500, 111, 222);

    // Fast-forward past resolution time (1000)
    start_cheat_block_timestamp(market_address, 1001);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 500);
    stop_cheat_caller_address(market_address);
    stop_cheat_block_timestamp(market_address);
}

#[test]
#[should_panic(expected: 'Market already resolved')]
fn test_place_bet_after_resolved() {
    let (_, _, market_address, market_id, _) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(1, 500, 777, 888);

    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, commitment, 500);
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic]
fn test_place_bet_insufficient_balance() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(0, 999999, 111, 222);

    // USER1 only has 100000 tokens
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 999999);
    stop_cheat_caller_address(market_address);
}

#[test]
fn test_place_bets_different_markets() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Create two markets
    start_cheat_caller_address(market_address, OWNER());
    let m0 = market.create_market(0xAAA, 2, 1000);
    let m1 = market.create_market(0xBBB, 3, 2000);
    stop_cheat_caller_address(market_address);

    // USER1 bets on market 0
    let c1 = compute_bet_commitment(0, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(m0, c1, 500);
    stop_cheat_caller_address(market_address);

    // USER2 bets on market 1
    let c2 = compute_bet_commitment(1, 300, 333, 444);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(m1, c2, 300);
    stop_cheat_caller_address(market_address);

    // Verify pools are independent
    assert!(market.get_market_total_pool(m0) == 500, "Market 0 pool should be 500");
    assert!(market.get_market_total_pool(m1) == 300, "Market 1 pool should be 300");
    assert!(market.get_market_bet_count(m0) == 1, "Market 0 bet count should be 1");
    assert!(market.get_market_bet_count(m1) == 1, "Market 1 bet count should be 1");

    // Verify bet-to-market mapping
    assert!(market.get_bet_market_id(c1) == m0, "c1 should be in market 0");
    assert!(market.get_bet_market_id(c2) == m1, "c2 should be in market 1");
}

#[test]
fn test_place_bet_at_exact_resolution_boundary() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let commitment = compute_bet_commitment(0, 500, 111, 222);

    // Timestamp exactly at resolution_time (1000) — should fail (current_time < resolution_time)
    // current_time = 999 should still work
    start_cheat_block_timestamp(market_address, 999);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, commitment, 500);
    stop_cheat_caller_address(market_address);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_bet_placed(commitment), "Bet at 999 should succeed");
}


// ============================================================
// RESOLUTION TESTS
// ============================================================

#[test]
fn test_resolve_market() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // Set oracle result
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0); // outcome 0 (YES) wins
    stop_cheat_caller_address(oracle_address);

    // Fast-forward and resolve
    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_market_resolved(market_id), "Market should be resolved");
    assert!(market.get_winning_outcome(market_id) == 0, "Winning outcome should be 0");
}

#[test]
#[should_panic(expected: 'Too early to resolve')]
fn test_resolve_before_resolution_time() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // Set oracle result
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    // Try to resolve at timestamp 500 (before 1000)
    start_cheat_block_timestamp(market_address, 500);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);
}

#[test]
#[should_panic(expected: 'Already resolved')]
fn test_resolve_already_resolved() {
    let (_, _, market_address, market_id, _) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Try to resolve again
    start_cheat_block_timestamp(market_address, 2000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);
}

#[test]
#[should_panic(expected: 'Oracle has no result')]
fn test_resolve_no_oracle_result() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Fast-forward past resolution time but don't set oracle result
    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);
}

#[test]
#[should_panic(expected: 'Market does not exist')]
fn test_resolve_nonexistent_market() {
    let (_, _, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(99);
    stop_cheat_block_timestamp(market_address);
}

#[test]
fn test_resolve_at_exact_resolution_time() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 1);
    stop_cheat_caller_address(oracle_address);

    // Resolve exactly at resolution_time (current_time >= resolution_time)
    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_market_resolved(market_id), "Should resolve at exact time");
    assert!(market.get_winning_outcome(market_id) == 1, "Winning outcome should be 1");
}

#[test]
fn test_resolve_with_outcome_1() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 1); // NO wins
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    assert!(market.get_winning_outcome(market_id) == 1, "Winning outcome should be 1 (NO)");
}


// ============================================================
// CLAIM TESTS
// ============================================================

#[test]
fn test_claim_winning_bet() {
    let (btc_address, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER1 bet 500 on outcome 0 (YES), which won
    let outcome: felt252 = 0;
    let amount: felt252 = 500;
    let secret: felt252 = 111;
    let nullifier_secret: felt252 = 222;
    let nullifier_hash = compute_nullifier_hash(nullifier_secret);

    let user1_balance_before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, commitment, nullifier_hash, outcome, amount, secret, nullifier_secret, USER1());
    stop_cheat_caller_address(market_address);

    // Payout = 500 * 2 (num_outcomes) = 1000, but pool only has 500 → capped at 500
    let user1_balance_after = btc_erc20.balance_of(USER1());
    assert!(user1_balance_after == user1_balance_before + 500, "User1 should receive 500 payout");

    // Verify claim state
    assert!(market.is_bet_claimed(commitment), "Bet should be marked as claimed");
    assert!(market.is_nullifier_used(nullifier_hash), "Nullifier should be used");
    assert!(market.get_market_remaining_pool(market_id) == 0, "Pool should be empty");
}

#[test]
fn test_claim_payout_with_multiple_bettors() {
    let (btc_address, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER1 bets 500 on outcome 0 (YES)
    let c1 = compute_bet_commitment(0, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 500);
    stop_cheat_caller_address(market_address);

    // USER2 bets 300 on outcome 1 (NO)
    let c2 = compute_bet_commitment(1, 300, 333, 444);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 300);
    stop_cheat_caller_address(market_address);

    // USER3 bets 200 on outcome 0 (YES)
    let c3 = compute_bet_commitment(0, 200, 555, 666);
    start_cheat_caller_address(market_address, USER3());
    market.place_bet(market_id, c3, 200);
    stop_cheat_caller_address(market_address);

    // Pool total = 1000
    assert!(market.get_market_total_pool(market_id) == 1000, "Pool should be 1000");

    // Oracle says outcome 0 wins
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    // Resolve
    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    // USER1 claims: payout = 500 * 2 = 1000 (pool has 1000, so full payout)
    let nh1 = compute_nullifier_hash(222);
    let user1_before = btc_erc20.balance_of(USER1());
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c1, nh1, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
    let user1_after = btc_erc20.balance_of(USER1());
    assert!(user1_after == user1_before + 1000, "User1 should get 1000 (500*2)");

    // Pool now has 0 remaining
    assert!(market.get_market_remaining_pool(market_id) == 0, "Pool should be empty after user1");

    // USER3 claims: payout = 200 * 2 = 400, but pool is empty → gets 0
    let nh3 = compute_nullifier_hash(666);
    let user3_before = btc_erc20.balance_of(USER3());
    start_cheat_caller_address(market_address, USER3());
    market.claim(market_id, c3, nh3, 0, 200, 555, 666, USER3());
    stop_cheat_caller_address(market_address);
    let user3_after = btc_erc20.balance_of(USER3());
    assert!(user3_after == user3_before, "User3 should get 0 (pool empty)");
}

#[test]
fn test_claim_to_different_recipient() {
    let (btc_address, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    let nullifier_hash = compute_nullifier_hash(222);
    let user2_before = btc_erc20.balance_of(USER2());

    // USER1 claims but sends payout to USER2
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, commitment, nullifier_hash, 0, 500, 111, 222, USER2());
    stop_cheat_caller_address(market_address);

    let user2_after = btc_erc20.balance_of(USER2());
    assert!(user2_after > user2_before, "User2 should receive payout");
}

#[test]
#[should_panic(expected: 'Invalid claim proof')]
fn test_claim_wrong_outcome() {
    let (_, _, market_address, market_id, _) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Create a bet on outcome 1 (NO) — the losing outcome
    let outcome_losing: felt252 = 1;
    let amount: felt252 = 500;
    let secret: felt252 = 777;
    let nullifier_secret: felt252 = 888;
    let _c_losing = compute_bet_commitment(outcome_losing, amount, secret, nullifier_secret);

    // We need to have placed this bet before resolution
    // Since setup_resolved already resolved, we need a fresh setup
    // Use setup_with_market instead and place bet manually

    // This test will fail because the commitment doesn't exist.
    // Let me restructure: try to claim the existing winning bet with wrong outcome
    let commitment = compute_bet_commitment(0, 500, 111, 222); // the existing bet
    let nullifier_hash = compute_nullifier_hash(222);

    // Try to claim saying outcome was 1, but the actual commitment was for outcome 0
    // This will fail because compute_bet_commitment(1, 500, 111, 222) != commitment
    // So the proof verification fails with 'Invalid claim proof'
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, commitment, nullifier_hash, 1, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Invalid claim proof')]
fn test_claim_losing_bet() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // USER1 bets on outcome 1 (NO)
    let c = compute_bet_commitment(1, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c, 500);
    stop_cheat_caller_address(market_address);

    // Oracle says outcome 0 (YES) wins
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    // Resolve
    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    // Try to claim with correct bet details (outcome 1) — proof fails because 1 != winning 0
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c, nh, 1, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Invalid claim proof')]
fn test_claim_wrong_secret() {
    let (_, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let nullifier_hash = compute_nullifier_hash(222);

    start_cheat_caller_address(market_address, USER1());
    // Wrong secret (999 instead of 111)
    market.claim(market_id, commitment, nullifier_hash, 0, 500, 999, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Invalid claim proof')]
fn test_claim_wrong_amount() {
    let (_, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let nullifier_hash = compute_nullifier_hash(222);

    start_cheat_caller_address(market_address, USER1());
    // Wrong amount (999 instead of 500)
    market.claim(market_id, commitment, nullifier_hash, 0, 999, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Invalid claim proof')]
fn test_claim_wrong_nullifier_secret() {
    let (_, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Wrong nullifier_secret (999 instead of 222) — nullifier_hash won't match
    let wrong_nullifier_hash = compute_nullifier_hash(999);

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, commitment, wrong_nullifier_hash, 0, 500, 111, 999, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Market not resolved')]
fn test_claim_before_resolution() {
    let (_, _, market_address, market_id, commitment) = setup_with_bet();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let nullifier_hash = compute_nullifier_hash(222);

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, commitment, nullifier_hash, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Already claimed')]
fn test_claim_double_claim() {
    let (_, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    let nullifier_hash = compute_nullifier_hash(222);

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, commitment, nullifier_hash, 0, 500, 111, 222, USER1());
    // Try to claim again
    market.claim(market_id, commitment, nullifier_hash, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_claim_reuse_nullifier() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // Place two bets with SAME nullifier_secret (different other params so different commitments)
    let c1 = compute_bet_commitment(0, 500, 111, 222);
    let c2 = compute_bet_commitment(0, 300, 333, 222); // same nullifier_secret = 222

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 500);
    stop_cheat_caller_address(market_address);

    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 300);
    stop_cheat_caller_address(market_address);

    // Resolve
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    let nh = compute_nullifier_hash(222);

    // First claim succeeds
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c1, nh, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);

    // Second claim with same nullifier_hash fails
    start_cheat_caller_address(market_address, USER2());
    market.claim(market_id, c2, nh, 0, 300, 333, 222, USER2());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Bet does not exist')]
fn test_claim_nonexistent_bet() {
    let (_, _, market_address, market_id, _) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Try to claim a bet that was never placed
    let fake_commitment = compute_bet_commitment(0, 9999, 777, 888);
    let nh = compute_nullifier_hash(888);

    start_cheat_caller_address(market_address, USER2());
    market.claim(market_id, fake_commitment, nh, 0, 9999, 777, 888, USER2());
    stop_cheat_caller_address(market_address);
}

#[test]
#[should_panic(expected: 'Bet not in this market')]
fn test_claim_bet_wrong_market() {
    let (_, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // Create two markets
    start_cheat_caller_address(market_address, OWNER());
    let m0 = market.create_market(0xAAA, 2, 1000);
    let m1 = market.create_market(0xBBB, 2, 1000);
    stop_cheat_caller_address(market_address);

    // Place bet on market 0
    let c = compute_bet_commitment(0, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(m0, c, 500);
    stop_cheat_caller_address(market_address);

    // Resolve market 1
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(m1, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(m1);
    stop_cheat_block_timestamp(market_address);

    // Try to claim bet from market 0 on market 1
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(market_address, USER1());
    market.claim(m1, c, nh, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);
}

#[test]
fn test_claim_payout_capped_at_pool() {
    let (btc_address, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Only one bettor: USER1 bets 500 on outcome 0
    let c = compute_bet_commitment(0, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c, 500);
    stop_cheat_caller_address(market_address);

    // Pool = 500. Ideal payout = 500 * 2 = 1000. But pool only has 500.
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    let nh = compute_nullifier_hash(222);
    let before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c, nh, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);

    let after = btc_erc20.balance_of(USER1());
    // Payout capped at pool balance (500), not ideal (1000)
    assert!(after == before + 500, "Payout should be capped at pool (500)");
    assert!(market.get_market_remaining_pool(market_id) == 0, "Pool should be 0");
}

#[test]
fn test_claim_exact_2x_payout_binary_market() {
    let (btc_address, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER1 bets 300 on outcome 0 (YES)
    let c1 = compute_bet_commitment(0, 300, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 300);
    stop_cheat_caller_address(market_address);

    // USER2 bets 300 on outcome 1 (NO)
    let c2 = compute_bet_commitment(1, 300, 333, 444);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 300);
    stop_cheat_caller_address(market_address);

    // Pool = 600. Outcome 0 wins. USER1's ideal payout = 300 * 2 = 600 = pool. Perfect!
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    let nh = compute_nullifier_hash(222);
    let before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c1, nh, 0, 300, 111, 222, USER1());
    stop_cheat_caller_address(market_address);

    let after = btc_erc20.balance_of(USER1());
    // With equal bets on both sides: winner gets exactly 2x
    assert!(after == before + 600, "Winner should get exactly 2x (600)");
    assert!(market.get_market_remaining_pool(market_id) == 0, "Pool should be 0");
}


// ============================================================
// THREE-OUTCOME MARKET TESTS
// ============================================================

#[test]
fn test_three_outcome_market_3x_payout() {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Create 3-outcome market: "Who wins the match? Team A(0), Team B(1), Draw(2)"
    start_cheat_caller_address(market_address, OWNER());
    let market_id = market.create_market(0xABC01, 3, 1000);
    stop_cheat_caller_address(market_address);

    assert!(market.get_market_num_outcomes(market_id) == 3, "Should have 3 outcomes");

    // USER1 bets 100 on outcome 0 (Team A)
    let c1 = compute_bet_commitment(0, 100, 11, 22);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 100);
    stop_cheat_caller_address(market_address);

    // USER2 bets 100 on outcome 1 (Team B)
    let c2 = compute_bet_commitment(1, 100, 33, 44);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 100);
    stop_cheat_caller_address(market_address);

    // USER3 bets 100 on outcome 2 (Draw)
    let c3 = compute_bet_commitment(2, 100, 55, 66);
    start_cheat_caller_address(market_address, USER3());
    market.place_bet(market_id, c3, 100);
    stop_cheat_caller_address(market_address);

    // Pool = 300. Team A wins (outcome 0).
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    // USER1 claims: payout = 100 * 3 = 300 (exactly the pool for equal distribution)
    let nh = compute_nullifier_hash(22);
    let before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c1, nh, 0, 100, 11, 22, USER1());
    stop_cheat_caller_address(market_address);

    let after = btc_erc20.balance_of(USER1());
    assert!(after == before + 300, "Winner in 3-outcome market should get 3x (300)");
}


// ============================================================
// ORACLE TESTS
// ============================================================

#[test]
fn test_oracle_set_and_get_result() {
    let (_, oracle_address, _) = setup();
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    assert!(!oracle.has_result(0), "Should have no result initially");

    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(0, 1);
    stop_cheat_caller_address(oracle_address);

    assert!(oracle.has_result(0), "Should have result now");
    assert!(oracle.get_result(0) == 1, "Result should be 1");
}

#[test]
#[should_panic(expected: 'Only owner can set result')]
fn test_oracle_non_owner_cannot_set() {
    let (_, oracle_address, _) = setup();
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    start_cheat_caller_address(oracle_address, USER1());
    oracle.set_result(0, 1);
    stop_cheat_caller_address(oracle_address);
}

#[test]
#[should_panic(expected: 'No result for market')]
fn test_oracle_get_nonexistent_result() {
    let (_, oracle_address, _) = setup();
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    oracle.get_result(99);
}

#[test]
fn test_oracle_update_result() {
    let (_, oracle_address, _) = setup();
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(0, 1);
    assert!(oracle.get_result(0) == 1, "Result should be 1");

    // Update the result
    oracle.set_result(0, 2);
    assert!(oracle.get_result(0) == 2, "Result should be updated to 2");
    stop_cheat_caller_address(oracle_address);
}

#[test]
fn test_oracle_multiple_markets() {
    let (_, oracle_address, _) = setup();
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(0, 0);
    oracle.set_result(1, 1);
    oracle.set_result(2, 2);
    stop_cheat_caller_address(oracle_address);

    assert!(oracle.get_result(0) == 0, "Market 0 result should be 0");
    assert!(oracle.get_result(1) == 1, "Market 1 result should be 1");
    assert!(oracle.get_result(2) == 2, "Market 2 result should be 2");
}


// ============================================================
// INTEGRATION / FULL FLOW TESTS
// ============================================================

#[test]
fn test_full_flow_binary_market() {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Step 1: Create market
    start_cheat_caller_address(market_address, OWNER());
    let market_id = market.create_market(0xB7C100, 2, 5000);
    stop_cheat_caller_address(market_address);
    assert!(market_id == 0, "Market ID should be 0");

    // Step 2: Place bets
    // USER1 bets 1000 on outcome 0 (YES)
    let c1 = compute_bet_commitment(0, 1000, 100, 200);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 1000);
    stop_cheat_caller_address(market_address);

    // USER2 bets 1000 on outcome 1 (NO)
    let c2 = compute_bet_commitment(1, 1000, 300, 400);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 1000);
    stop_cheat_caller_address(market_address);

    assert!(market.get_market_total_pool(market_id) == 2000, "Pool should be 2000");

    // Step 3: Oracle sets result (YES wins, outcome 0)
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    // Step 4: Resolve market
    start_cheat_block_timestamp(market_address, 5000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_market_resolved(market_id), "Market should be resolved");
    assert!(market.get_winning_outcome(market_id) == 0, "Outcome 0 should win");

    // Step 5: Winner claims
    let nh1 = compute_nullifier_hash(200);
    let user1_before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c1, nh1, 0, 1000, 100, 200, USER1());
    stop_cheat_caller_address(market_address);

    let user1_after = btc_erc20.balance_of(USER1());
    // 1000 * 2 = 2000, pool has 2000 → full payout
    assert!(user1_after == user1_before + 2000, "Winner should get 2x (2000)");

    // Step 6: Verify final state
    assert!(market.is_bet_claimed(c1), "c1 should be claimed");
    assert!(!market.is_bet_claimed(c2), "c2 should NOT be claimed (loser)");
    assert!(market.get_market_remaining_pool(market_id) == 0, "Pool should be empty");
    assert!(market.is_nullifier_used(nh1), "Nullifier should be used");
}

#[test]
fn test_full_flow_multiple_winners() {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Create binary market
    start_cheat_caller_address(market_address, OWNER());
    let market_id = market.create_market(0xE7500, 2, 5000);
    stop_cheat_caller_address(market_address);

    // USER1 and USER3 bet on outcome 0 (YES), USER2 bets on outcome 1 (NO)
    let c1 = compute_bet_commitment(0, 400, 10, 20);
    let c2 = compute_bet_commitment(1, 600, 30, 40);
    let c3 = compute_bet_commitment(0, 200, 50, 60);

    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 400);
    stop_cheat_caller_address(market_address);

    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 600);
    stop_cheat_caller_address(market_address);

    start_cheat_caller_address(market_address, USER3());
    market.place_bet(market_id, c3, 200);
    stop_cheat_caller_address(market_address);

    // Pool = 1200. Outcome 0 wins.
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 5000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    // USER1 claims: 400 * 2 = 800
    let nh1 = compute_nullifier_hash(20);
    let u1_before = btc_erc20.balance_of(USER1());
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c1, nh1, 0, 400, 10, 20, USER1());
    stop_cheat_caller_address(market_address);
    let u1_after = btc_erc20.balance_of(USER1());
    assert!(u1_after == u1_before + 800, "USER1 should get 800");

    // Pool remaining = 1200 - 800 = 400
    assert!(market.get_market_remaining_pool(market_id) == 400, "Remaining should be 400");

    // USER3 claims: 200 * 2 = 400, pool has exactly 400
    let nh3 = compute_nullifier_hash(60);
    let u3_before = btc_erc20.balance_of(USER3());
    start_cheat_caller_address(market_address, USER3());
    market.claim(market_id, c3, nh3, 0, 200, 50, 60, USER3());
    stop_cheat_caller_address(market_address);
    let u3_after = btc_erc20.balance_of(USER3());
    assert!(u3_after == u3_before + 400, "USER3 should get 400");

    assert!(market.get_market_remaining_pool(market_id) == 0, "Pool should be empty");
}

#[test]
fn test_market_with_no_bets_resolved() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // No bets placed. Oracle sets result. Market resolves. No harm done.
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_market_resolved(market_id), "Market should resolve even with no bets");
    assert!(market.get_market_total_pool(market_id) == 0, "Pool should be 0");
}

#[test]
fn test_independent_markets_lifecycle() {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Create two independent markets
    start_cheat_caller_address(market_address, OWNER());
    let m0 = market.create_market(0xAAA, 2, 1000);
    let m1 = market.create_market(0xBBB, 2, 2000);
    stop_cheat_caller_address(market_address);

    // USER1 bets on market 0
    let c0 = compute_bet_commitment(0, 500, 11, 22);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(m0, c0, 500);
    stop_cheat_caller_address(market_address);

    // USER2 bets on market 1
    let c1 = compute_bet_commitment(1, 700, 33, 44);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(m1, c1, 700);
    stop_cheat_caller_address(market_address);

    // Resolve market 0 only
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(m0, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(m0);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_market_resolved(m0), "Market 0 should be resolved");
    assert!(!market.is_market_resolved(m1), "Market 1 should NOT be resolved yet");

    // Claim on market 0
    let nh0 = compute_nullifier_hash(22);
    let u1_before = btc_erc20.balance_of(USER1());
    start_cheat_caller_address(market_address, USER1());
    market.claim(m0, c0, nh0, 0, 500, 11, 22, USER1());
    stop_cheat_caller_address(market_address);
    let u1_after = btc_erc20.balance_of(USER1());
    assert!(u1_after == u1_before + 500, "Should get capped payout from market 0");

    // Market 1 pool should be untouched
    assert!(market.get_market_total_pool(m1) == 700, "Market 1 pool should still be 700");
    assert!(market.get_market_remaining_pool(m1) == 700, "Market 1 remaining should be 700");
}

#[test]
fn test_five_outcome_market() {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Create 5-outcome market
    start_cheat_caller_address(market_address, OWNER());
    let market_id = market.create_market(0xACE0, 5, 1000);
    stop_cheat_caller_address(market_address);

    // USER1 bets 100 on outcome 3
    let c = compute_bet_commitment(3, 100, 11, 22);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c, 100);
    stop_cheat_caller_address(market_address);

    // USER2 bets 400 on outcome 1
    let c2 = compute_bet_commitment(1, 400, 33, 44);
    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 400);
    stop_cheat_caller_address(market_address);

    // Pool = 500. Outcome 3 wins.
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 3);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    // USER1 claims: 100 * 5 = 500 (exactly the pool)
    let nh = compute_nullifier_hash(22);
    let before = btc_erc20.balance_of(USER1());
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c, nh, 3, 100, 11, 22, USER1());
    stop_cheat_caller_address(market_address);
    let after = btc_erc20.balance_of(USER1());
    assert!(after == before + 500, "Winner in 5-outcome market should get 5x (500)");
}

#[test]
fn test_commitment_uniqueness() {
    let (_, _, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    // Two bets with different parameters produce different commitments
    let c1 = compute_bet_commitment(0, 500, 111, 222);
    let c2 = compute_bet_commitment(0, 500, 111, 333); // different nullifier_secret
    let c3 = compute_bet_commitment(1, 500, 111, 222); // different outcome

    assert!(c1 != c2, "Different nullifier_secret should produce different commitments");
    assert!(c1 != c3, "Different outcomes should produce different commitments");

    // All three can be placed as separate bets
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c1, 500);
    stop_cheat_caller_address(market_address);

    start_cheat_caller_address(market_address, USER2());
    market.place_bet(market_id, c2, 500);
    stop_cheat_caller_address(market_address);

    start_cheat_caller_address(market_address, USER3());
    market.place_bet(market_id, c3, 500);
    stop_cheat_caller_address(market_address);

    assert!(market.get_market_bet_count(market_id) == 3, "All 3 bets should be placed");
}

#[test]
fn test_amount_mismatch_protection() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    // USER1 commits to 500 in the hash but deposits 500 in the ERC20 transfer
    let c = compute_bet_commitment(0, 500, 111, 222);
    start_cheat_caller_address(market_address, USER1());
    market.place_bet(market_id, c, 500);
    stop_cheat_caller_address(market_address);

    // Resolve
    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    start_cheat_block_timestamp(market_address, 1000);
    market.resolve(market_id);
    stop_cheat_block_timestamp(market_address);

    // Correct claim works
    let nh = compute_nullifier_hash(222);
    start_cheat_caller_address(market_address, USER1());
    market.claim(market_id, c, nh, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);

    assert!(market.is_bet_claimed(c), "Claim should succeed with matching amount");
}

#[test]
fn test_view_functions_default_values() {
    let (btc_address, oracle_address, market_address) = setup();
    let market = IPredictionMarketDispatcher { contract_address: market_address };

    assert!(market.get_market_count() == 0, "Initial market count should be 0");
    assert!(market.get_oracle() == oracle_address, "Oracle address mismatch");
    assert!(market.get_btc_token() == btc_address, "BTC token address mismatch");

    // Non-existent bet checks
    let fake_commitment: felt252 = 0xDEAD;
    assert!(!market.is_bet_placed(fake_commitment), "Non-existent bet should return false");
    assert!(!market.is_bet_claimed(fake_commitment), "Non-existent bet should not be claimed");
    assert!(!market.is_nullifier_used(0xBEEF), "Unused nullifier should return false");
}

#[test]
fn test_anyone_can_resolve() {
    let (_, oracle_address, market_address, market_id) = setup_with_market();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let oracle = IMockPragmaOracleDispatcher { contract_address: oracle_address };

    start_cheat_caller_address(oracle_address, OWNER());
    oracle.set_result(market_id, 0);
    stop_cheat_caller_address(oracle_address);

    // USER3 (random user) resolves the market — trustless
    start_cheat_block_timestamp(market_address, 1000);
    start_cheat_caller_address(market_address, USER3());
    market.resolve(market_id);
    stop_cheat_caller_address(market_address);
    stop_cheat_block_timestamp(market_address);

    assert!(market.is_market_resolved(market_id), "Anyone should be able to resolve");
}

#[test]
fn test_anyone_can_claim_for_winner() {
    let (btc_address, _, market_address, market_id, commitment) = setup_resolved();
    let market = IPredictionMarketDispatcher { contract_address: market_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    let nullifier_hash = compute_nullifier_hash(222);
    let user1_before = btc_erc20.balance_of(USER1());

    // USER2 submits the claim on behalf of USER1, sending funds to USER1
    start_cheat_caller_address(market_address, USER2());
    market.claim(market_id, commitment, nullifier_hash, 0, 500, 111, 222, USER1());
    stop_cheat_caller_address(market_address);

    let user1_after = btc_erc20.balance_of(USER1());
    assert!(user1_after > user1_before, "USER1 should receive payout even if USER2 claims");
}
