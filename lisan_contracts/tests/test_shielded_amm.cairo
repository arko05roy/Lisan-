use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::mock_strk::{IMockSTRKDispatcher, IMockSTRKDispatcherTrait};
use lisan_contracts::shielded_amm::{IShieldedAMMDispatcher, IShieldedAMMDispatcherTrait};
use lisan_contracts::commitment::{compute_amm_commitment, compute_nullifier_hash};

// Token type constants — must match shielded_amm.cairo
const TOKEN_TYPE_BTC: felt252 = 1;
const TOKEN_TYPE_STRK: felt252 = 2;

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

/// Deploy MockBTC, MockSTRK, and ShieldedAMM. Does NOT seed liquidity.
/// Mints tokens to OWNER, USER1, USER2 and sets up approvals for AMM.
fn setup() -> (ContractAddress, ContractAddress, ContractAddress) {
    // Deploy MockBTC
    let btc_class = declare("MockBTC").unwrap().contract_class();
    let mut btc_calldata = array![];
    OWNER().serialize(ref btc_calldata);
    let (btc_address, _) = btc_class.deploy(@btc_calldata).unwrap();

    // Deploy MockSTRK
    let strk_class = declare("MockSTRK").unwrap().contract_class();
    let mut strk_calldata = array![];
    OWNER().serialize(ref strk_calldata);
    let (strk_address, _) = strk_class.deploy(@strk_calldata).unwrap();

    // Deploy ShieldedAMM
    let amm_class = declare("ShieldedAMM").unwrap().contract_class();
    let mut amm_calldata = array![];
    OWNER().serialize(ref amm_calldata);
    btc_address.serialize(ref amm_calldata);
    strk_address.serialize(ref amm_calldata);
    let (amm_address, _) = amm_class.deploy(@amm_calldata).unwrap();

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    let mock_strk = IMockSTRKDispatcher { contract_address: strk_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    // Mint tokens to OWNER (for seeding)
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(OWNER(), 1000000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(OWNER(), 1000000);
    stop_cheat_caller_address(strk_address);

    // Owner approves AMM for both tokens
    start_cheat_caller_address(btc_address, OWNER());
    btc_erc20.approve(amm_address, 1000000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, OWNER());
    strk_erc20.approve(amm_address, 1000000);
    stop_cheat_caller_address(strk_address);

    // Mint tokens to USER1
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(USER1(), 100000);
    stop_cheat_caller_address(strk_address);

    // USER1 approves AMM
    start_cheat_caller_address(btc_address, USER1());
    btc_erc20.approve(amm_address, 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, USER1());
    strk_erc20.approve(amm_address, 100000);
    stop_cheat_caller_address(strk_address);

    // Mint tokens to USER2
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER2(), 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(USER2(), 100000);
    stop_cheat_caller_address(strk_address);

    // USER2 approves AMM
    start_cheat_caller_address(btc_address, USER2());
    btc_erc20.approve(amm_address, 100000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, USER2());
    strk_erc20.approve(amm_address, 100000);
    stop_cheat_caller_address(strk_address);

    (btc_address, strk_address, amm_address)
}

/// Deploy + seed liquidity with 10000 BTC and 50000 STRK (1 BTC = 5 STRK initial price)
fn setup_seeded() -> (ContractAddress, ContractAddress, ContractAddress) {
    let (btc_address, strk_address, amm_address) = setup();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    start_cheat_caller_address(amm_address, OWNER());
    amm.seed_liquidity(10000, 50000);
    stop_cheat_caller_address(amm_address);

    (btc_address, strk_address, amm_address)
}

/// Deploy + seed + deposit BTC for USER1
fn setup_with_btc_deposit() -> (ContractAddress, ContractAddress, ContractAddress, felt252) {
    let (btc_address, strk_address, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // USER1 deposits 1000 BTC into AMM shielded pool
    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    (btc_address, strk_address, amm_address, commitment)
}

// ============================================================
// SEED LIQUIDITY TESTS
// ============================================================

#[test]
fn test_seed_liquidity() {
    let (btc_address, strk_address, amm_address) = setup();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    assert!(!amm.is_seeded(), "Should not be seeded yet");

    start_cheat_caller_address(amm_address, OWNER());
    amm.seed_liquidity(10000, 50000);
    stop_cheat_caller_address(amm_address);

    assert!(amm.is_seeded(), "Should be seeded");
    assert!(amm.get_btc_reserve() == 10000, "BTC reserve wrong");
    assert!(amm.get_strk_reserve() == 50000, "STRK reserve wrong");
    assert!(btc_erc20.balance_of(amm_address) == 10000, "AMM BTC balance wrong");
    assert!(strk_erc20.balance_of(amm_address) == 50000, "AMM STRK balance wrong");
}

#[test]
#[should_panic(expected: 'Only owner can seed')]
fn test_seed_liquidity_not_owner_fails() {
    let (_, _, amm_address) = setup();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    start_cheat_caller_address(amm_address, USER1());
    amm.seed_liquidity(10000, 50000);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Already seeded')]
fn test_seed_liquidity_twice_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    start_cheat_caller_address(amm_address, OWNER());
    amm.seed_liquidity(5000, 25000);
    stop_cheat_caller_address(amm_address);
}

// ============================================================
// DEPOSIT TESTS
// ============================================================

#[test]
fn test_deposit_btc() {
    let (btc_address, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);

    let user_balance_before = btc_erc20.balance_of(USER1());

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    assert!(amm.is_commitment_valid(commitment), "Commitment should be valid");
    assert!(amm.get_commitment_count() == 1, "Count should be 1");
    assert!(
        btc_erc20.balance_of(USER1()) == user_balance_before - 1000, "User BTC balance wrong",
    );

    // Reserves should NOT change from deposit
    assert!(amm.get_btc_reserve() == 10000, "BTC reserve should be unchanged");
    assert!(amm.get_strk_reserve() == 50000, "STRK reserve should be unchanged");
}

#[test]
fn test_deposit_strk() {
    let (_, strk_address, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    let commitment = compute_amm_commitment(5000, TOKEN_TYPE_STRK, 77, 88);

    let user_balance_before = strk_erc20.balance_of(USER1());

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_STRK, 5000, commitment);
    stop_cheat_caller_address(amm_address);

    assert!(amm.is_commitment_valid(commitment), "Commitment should be valid");
    assert!(amm.get_commitment_count() == 1, "Count should be 1");
    assert!(
        strk_erc20.balance_of(USER1()) == user_balance_before - 5000, "User STRK balance wrong",
    );

    // Reserves should NOT change from deposit
    assert!(amm.get_btc_reserve() == 10000, "BTC reserve unchanged");
    assert!(amm.get_strk_reserve() == 50000, "STRK reserve unchanged");
}

#[test]
#[should_panic(expected: 'Amount must be > 0')]
fn test_deposit_zero_amount_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let commitment = compute_amm_commitment(0, TOKEN_TYPE_BTC, 42, 99);

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 0, commitment);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Commitment already exists')]
fn test_deposit_duplicate_commitment_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let commitment = compute_amm_commitment(500, TOKEN_TYPE_BTC, 42, 99);

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 500, commitment);
    amm.deposit(TOKEN_TYPE_BTC, 500, commitment);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Invalid token type')]
fn test_deposit_invalid_token_type_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let commitment = compute_amm_commitment(500, 3, 42, 99);

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(3, 500, commitment);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic]
fn test_deposit_insufficient_balance_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let commitment = compute_amm_commitment(999999, TOKEN_TYPE_BTC, 42, 99);

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 999999, commitment);
    stop_cheat_caller_address(amm_address);
}

// ============================================================
// SWAP TESTS
// ============================================================

#[test]
fn test_swap_btc_to_strk() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Calculate expected output: (50000 * 1000) / (10000 + 1000) = 50000000 / 11000 = 4545
    let expected_out: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let expected_out_felt: felt252 = expected_out.try_into().unwrap();

    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(expected_out_felt, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            expected_out_felt,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);

    // Old commitment should be invalidated
    assert!(!amm.is_commitment_valid(btc_commitment), "Old commitment should be invalid");

    // New commitment should be valid
    assert!(amm.is_commitment_valid(new_commitment), "New commitment should be valid");

    // Nullifier should be used
    assert!(amm.is_nullifier_used(nullifier_hash), "Nullifier should be used");

    // Reserves should be updated
    assert!(amm.get_btc_reserve() == 11000, "BTC reserve should be 11000");
    assert!(amm.get_strk_reserve() == 50000 - expected_out, "STRK reserve wrong");

    // Commitment count unchanged (one removed, one added)
    assert!(amm.get_commitment_count() == 1, "Count should still be 1");
}

#[test]
fn test_swap_strk_to_btc() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // USER1 deposits 5000 STRK
    let strk_commitment = compute_amm_commitment(5000, TOKEN_TYPE_STRK, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_STRK, 5000, strk_commitment);
    stop_cheat_caller_address(amm_address);

    // Swap STRK → BTC
    // Expected: (10000 * 5000) / (50000 + 5000) = 50000000 / 55000 = 909
    let expected_out: u256 = (10000_u256 * 5000_u256) / (50000_u256 + 5000_u256);
    let expected_out_felt: felt252 = expected_out.try_into().unwrap();

    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(expected_out_felt, TOKEN_TYPE_BTC, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            strk_commitment,
            nullifier_hash,
            5000,
            TOKEN_TYPE_STRK,
            42,
            99,
            new_commitment,
            expected_out_felt,
            TOKEN_TYPE_BTC,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);

    assert!(!amm.is_commitment_valid(strk_commitment), "Old commitment invalid");
    assert!(amm.is_commitment_valid(new_commitment), "New commitment valid");
    assert!(amm.get_strk_reserve() == 55000, "STRK reserve should be 55000");
    assert!(amm.get_btc_reserve() == 10000 - expected_out, "BTC reserve wrong");
}

#[test]
#[should_panic(expected: 'Invalid swap proof')]
fn test_swap_wrong_secret_fails() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let expected_out: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let expected_out_felt: felt252 = expected_out.try_into().unwrap();

    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(expected_out_felt, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            999, // WRONG secret (should be 42)
            99,
            new_commitment,
            expected_out_felt,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_swap_double_spend_fails() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let expected_out: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let expected_out_felt: felt252 = expected_out.try_into().unwrap();

    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(expected_out_felt, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            expected_out_felt,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);

    // Deposit another BTC commitment with same nullifier_secret=99
    let btc_commitment2 = compute_amm_commitment(500, TOKEN_TYPE_BTC, 77, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 500, btc_commitment2);
    stop_cheat_caller_address(amm_address);

    // Try to swap with same nullifier — should fail
    let new_commitment2 = compute_amm_commitment(100, TOKEN_TYPE_STRK, 201, 301);
    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment2,
            nullifier_hash, // same nullifier
            500,
            TOKEN_TYPE_BTC,
            77,
            99,
            new_commitment2,
            100,
            TOKEN_TYPE_STRK,
            201,
            301,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_swap_nonexistent_commitment_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Try to swap a commitment that was never deposited
    let fake_commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(100, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            fake_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            100,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Amount out mismatch')]
fn test_swap_wrong_amount_out_fails() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let nullifier_hash = compute_nullifier_hash(99);
    // User claims they should get 9999 STRK (wrong)
    let wrong_out: felt252 = 9999;
    let new_commitment = compute_amm_commitment(wrong_out, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            wrong_out,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Invalid swap proof')]
fn test_swap_same_token_type_fails() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(500, TOKEN_TYPE_BTC, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            500,
            TOKEN_TYPE_BTC, // same as input — should fail
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'AMM not seeded')]
fn test_swap_not_seeded_fails() {
    let (_, _, amm_address) = setup();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Deposit without seeding first
    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    // Try to swap — should fail because not seeded
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(100, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            100,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_swap_zero_amount_in_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // A commitment with amount=0 can never be deposited (deposit rejects 0),
    // so a zero-amount swap attempt will fail because the commitment doesn't exist.
    let commitment = compute_amm_commitment(0, TOKEN_TYPE_BTC, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(100, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            commitment,
            nullifier_hash,
            0,
            TOKEN_TYPE_BTC,
            42,
            99,
            new_commitment,
            100,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Invalid swap proof')]
fn test_swap_wrong_nullifier_secret_fails() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let expected_out: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let expected_out_felt: felt252 = expected_out.try_into().unwrap();

    // Use correct nullifier_hash but wrong nullifier_secret
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(expected_out_felt, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_BTC,
            42,
            88, // WRONG nullifier_secret (should be 99)
            new_commitment,
            expected_out_felt,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

// ============================================================
// WITHDRAW TESTS
// ============================================================

#[test]
fn test_withdraw_btc() {
    let (btc_address, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER1 deposits BTC
    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    let user_balance_before = btc_erc20.balance_of(USER1());
    let nullifier_hash = compute_nullifier_hash(99);

    // Withdraw BTC
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(commitment, nullifier_hash, 1000, TOKEN_TYPE_BTC, 42, 99, USER1(), 1000);
    stop_cheat_caller_address(amm_address);

    assert!(!amm.is_commitment_valid(commitment), "Commitment should be invalid");
    assert!(amm.is_nullifier_used(nullifier_hash), "Nullifier should be used");
    assert!(
        btc_erc20.balance_of(USER1()) == user_balance_before + 1000, "User BTC balance wrong",
    );
    assert!(amm.get_commitment_count() == 0, "Count should be 0");
}

#[test]
fn test_withdraw_strk() {
    let (_, strk_address, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    // USER1 deposits STRK
    let commitment = compute_amm_commitment(5000, TOKEN_TYPE_STRK, 77, 88);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_STRK, 5000, commitment);
    stop_cheat_caller_address(amm_address);

    let user_balance_before = strk_erc20.balance_of(USER1());
    let nullifier_hash = compute_nullifier_hash(88);

    // Withdraw STRK to USER2
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(commitment, nullifier_hash, 5000, TOKEN_TYPE_STRK, 77, 88, USER2(), 5000);
    stop_cheat_caller_address(amm_address);

    assert!(!amm.is_commitment_valid(commitment), "Commitment invalid");
    assert!(amm.is_nullifier_used(nullifier_hash), "Nullifier used");
    // USER1 balance unchanged (withdrew to USER2)
    assert!(strk_erc20.balance_of(USER1()) == user_balance_before, "USER1 STRK balance unchanged");
    assert!(strk_erc20.balance_of(USER2()) == 100000 + 5000, "USER2 received STRK");
    assert!(amm.get_commitment_count() == 0, "Count 0");
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_withdraw_double_spend_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Deposit two commitments with same nullifier_secret
    let c1 = compute_amm_commitment(500, TOKEN_TYPE_BTC, 42, 99);
    let c2 = compute_amm_commitment(500, TOKEN_TYPE_BTC, 77, 99); // same nullifier_secret

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 500, c1);
    amm.deposit(TOKEN_TYPE_BTC, 500, c2);
    stop_cheat_caller_address(amm_address);

    let nullifier_hash = compute_nullifier_hash(99);

    // First withdraw succeeds
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(c1, nullifier_hash, 500, TOKEN_TYPE_BTC, 42, 99, USER1(), 500);
    stop_cheat_caller_address(amm_address);

    // Second withdraw with same nullifier should fail
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(c2, nullifier_hash, 500, TOKEN_TYPE_BTC, 77, 99, USER1(), 500);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Invalid withdraw proof')]
fn test_withdraw_wrong_proof_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    let nullifier_hash = compute_nullifier_hash(99);

    // Wrong secret (999 instead of 42)
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(commitment, nullifier_hash, 1000, TOKEN_TYPE_BTC, 999, 99, USER1(), 1000);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_withdraw_nonexistent_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let fake = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(fake, nullifier_hash, 1000, TOKEN_TYPE_BTC, 42, 99, USER1(), 1000);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Invalid withdraw proof')]
fn test_withdraw_wrong_token_type_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Deposit as BTC
    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    let nullifier_hash = compute_nullifier_hash(99);

    // Try to withdraw as STRK — proof will fail because token_type is part of commitment
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(commitment, nullifier_hash, 1000, TOKEN_TYPE_STRK, 42, 99, USER1(), 1000);
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Invalid token type')]
fn test_withdraw_invalid_token_type_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let commitment = compute_amm_commitment(1000, 3, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    // Can't deposit with invalid type, so this will fail at deposit validation
    amm.deposit(3, 1000, commitment);
    stop_cheat_caller_address(amm_address);
}

// ============================================================
// INTEGRATION / FULL FLOW TESTS
// ============================================================

#[test]
fn test_full_flow_deposit_btc_swap_to_strk_withdraw_strk() {
    let (btc_address, strk_address, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    let user_btc_before = btc_erc20.balance_of(USER1());
    let user_strk_before = strk_erc20.balance_of(USER1());

    // Step 1: Deposit 1000 BTC
    let btc_commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, btc_commitment);
    stop_cheat_caller_address(amm_address);

    assert!(btc_erc20.balance_of(USER1()) == user_btc_before - 1000, "BTC deducted");

    // Step 2: Swap 1000 BTC → STRK
    let expected_strk: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let expected_strk_felt: felt252 = expected_strk.try_into().unwrap();

    let nullifier_hash_swap = compute_nullifier_hash(99);
    let strk_commitment = compute_amm_commitment(expected_strk_felt, TOKEN_TYPE_STRK, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash_swap,
            1000,
            TOKEN_TYPE_BTC,
            42,
            99,
            strk_commitment,
            expected_strk_felt,
            TOKEN_TYPE_STRK,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);

    assert!(amm.get_btc_reserve() == 11000, "BTC reserve after swap");
    assert!(amm.get_strk_reserve() == 50000 - expected_strk, "STRK reserve after swap");

    // Step 3: Withdraw STRK to USER1
    let nullifier_hash_withdraw = compute_nullifier_hash(300);
    let withdraw_amount: u256 = expected_strk;

    start_cheat_caller_address(amm_address, USER1());
    amm
        .withdraw(
            strk_commitment,
            nullifier_hash_withdraw,
            expected_strk_felt,
            TOKEN_TYPE_STRK,
            200,
            300,
            USER1(),
            withdraw_amount,
        );
    stop_cheat_caller_address(amm_address);

    // User should have received STRK
    assert!(
        strk_erc20.balance_of(USER1()) == user_strk_before + expected_strk, "User received STRK",
    );

    // User paid BTC
    assert!(btc_erc20.balance_of(USER1()) == user_btc_before - 1000, "User paid BTC");

    // All commitments consumed
    assert!(amm.get_commitment_count() == 0, "All commitments consumed");
    assert!(!amm.is_commitment_valid(btc_commitment), "BTC commitment consumed");
    assert!(!amm.is_commitment_valid(strk_commitment), "STRK commitment consumed");
}

#[test]
fn test_full_flow_deposit_strk_swap_to_btc_withdraw_btc() {
    let (btc_address, strk_address, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    let user_btc_before = btc_erc20.balance_of(USER1());
    let user_strk_before = strk_erc20.balance_of(USER1());

    // Step 1: Deposit 5000 STRK
    let strk_commitment = compute_amm_commitment(5000, TOKEN_TYPE_STRK, 11, 22);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_STRK, 5000, strk_commitment);
    stop_cheat_caller_address(amm_address);

    // Step 2: Swap 5000 STRK → BTC
    let expected_btc: u256 = (10000_u256 * 5000_u256) / (50000_u256 + 5000_u256);
    let expected_btc_felt: felt252 = expected_btc.try_into().unwrap();

    let nullifier_hash_swap = compute_nullifier_hash(22);
    let btc_commitment = compute_amm_commitment(expected_btc_felt, TOKEN_TYPE_BTC, 33, 44);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            strk_commitment,
            nullifier_hash_swap,
            5000,
            TOKEN_TYPE_STRK,
            11,
            22,
            btc_commitment,
            expected_btc_felt,
            TOKEN_TYPE_BTC,
            33,
            44,
        );
    stop_cheat_caller_address(amm_address);

    // Step 3: Withdraw BTC
    let nullifier_hash_withdraw = compute_nullifier_hash(44);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .withdraw(
            btc_commitment,
            nullifier_hash_withdraw,
            expected_btc_felt,
            TOKEN_TYPE_BTC,
            33,
            44,
            USER1(),
            expected_btc,
        );
    stop_cheat_caller_address(amm_address);

    assert!(btc_erc20.balance_of(USER1()) == user_btc_before + expected_btc, "User received BTC");
    assert!(strk_erc20.balance_of(USER1()) == user_strk_before - 5000, "User paid STRK");
    assert!(amm.get_commitment_count() == 0, "Commitments consumed");
}

#[test]
fn test_price_impact_large_swap() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Initial price: 1 BTC = 5 STRK
    // Small swap: 100 BTC → ? STRK
    let small_out = amm.get_amount_out(100, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK);
    // Expected: (50000 * 100) / (10000 + 100) = 5000000 / 10100 = 495
    assert!(small_out == 495, "Small swap output wrong");

    // Large swap: 5000 BTC → ? STRK
    let large_out = amm.get_amount_out(5000, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK);
    // Expected: (50000 * 5000) / (10000 + 5000) = 250000000 / 15000 = 16666
    assert!(large_out == 16666, "Large swap output wrong");

    // Price per BTC for small swap: 495 / 100 = 4.95 STRK/BTC (close to spot)
    // Price per BTC for large swap: 16666 / 5000 = 3.33 STRK/BTC (significant slippage)
    // This demonstrates price impact correctly
    assert!(small_out * 5000 > large_out * 100, "Large swap should have worse price per unit");
}

#[test]
fn test_multiple_swaps_price_movement() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // First swap: 1000 BTC → STRK
    let out1: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let out1_felt: felt252 = out1.try_into().unwrap();

    let c1 = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 1, 10);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, c1);
    stop_cheat_caller_address(amm_address);

    let n1 = compute_nullifier_hash(10);
    let c1_out = compute_amm_commitment(out1_felt, TOKEN_TYPE_STRK, 100, 110);

    start_cheat_caller_address(amm_address, USER1());
    amm.swap(c1, n1, 1000, TOKEN_TYPE_BTC, 1, 10, c1_out, out1_felt, TOKEN_TYPE_STRK, 100, 110);
    stop_cheat_caller_address(amm_address);

    // After first swap: BTC reserve = 11000, STRK reserve = 50000 - out1
    let btc_reserve_after_1 = amm.get_btc_reserve();
    let strk_reserve_after_1 = amm.get_strk_reserve();
    assert!(btc_reserve_after_1 == 11000, "BTC reserve after swap 1");
    assert!(strk_reserve_after_1 == 50000 - out1, "STRK reserve after swap 1");

    // Second swap: another 1000 BTC → STRK
    let out2: u256 = (strk_reserve_after_1 * 1000_u256) / (btc_reserve_after_1 + 1000_u256);
    let out2_felt: felt252 = out2.try_into().unwrap();

    let c2 = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 2, 20);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, c2);
    stop_cheat_caller_address(amm_address);

    let n2 = compute_nullifier_hash(20);
    let c2_out = compute_amm_commitment(out2_felt, TOKEN_TYPE_STRK, 200, 220);

    start_cheat_caller_address(amm_address, USER1());
    amm.swap(c2, n2, 1000, TOKEN_TYPE_BTC, 2, 20, c2_out, out2_felt, TOKEN_TYPE_STRK, 200, 220);
    stop_cheat_caller_address(amm_address);

    // Second swap should yield LESS STRK (price moved against buyer)
    assert!(out2 < out1, "Second swap should get less STRK due to price impact");

    // Reserves should be updated correctly
    assert!(amm.get_btc_reserve() == 12000, "BTC reserve after swap 2");
    assert!(amm.get_strk_reserve() == strk_reserve_after_1 - out2, "STRK reserve after swap 2");
}

#[test]
fn test_get_amount_out_view() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // BTC → STRK: (50000 * 1000) / (10000 + 1000) = 4545
    let out_btc_strk = amm.get_amount_out(1000, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK);
    assert!(out_btc_strk == 4545, "BTC->STRK quote wrong");

    // STRK → BTC: (10000 * 5000) / (50000 + 5000) = 909
    let out_strk_btc = amm.get_amount_out(5000, TOKEN_TYPE_STRK, TOKEN_TYPE_BTC);
    assert!(out_strk_btc == 909, "STRK->BTC quote wrong");
}

#[test]
fn test_reserves_unchanged_after_deposit_and_withdraw() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let btc_reserve_before = amm.get_btc_reserve();
    let strk_reserve_before = amm.get_strk_reserve();

    // Deposit BTC
    let c1 = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, c1);
    stop_cheat_caller_address(amm_address);

    assert!(amm.get_btc_reserve() == btc_reserve_before, "BTC reserve unchanged after deposit");
    assert!(
        amm.get_strk_reserve() == strk_reserve_before, "STRK reserve unchanged after deposit",
    );

    // Withdraw BTC
    let n1 = compute_nullifier_hash(99);
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(c1, n1, 1000, TOKEN_TYPE_BTC, 42, 99, USER1(), 1000);
    stop_cheat_caller_address(amm_address);

    assert!(amm.get_btc_reserve() == btc_reserve_before, "BTC reserve unchanged after withdraw");
    assert!(
        amm.get_strk_reserve() == strk_reserve_before, "STRK reserve unchanged after withdraw",
    );
}

#[test]
fn test_two_users_swap_in_sequence() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // USER1 deposits and swaps 1000 BTC → STRK
    let c1 = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 1, 10);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, c1);
    stop_cheat_caller_address(amm_address);

    let out1: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let out1_felt: felt252 = out1.try_into().unwrap();
    let n1 = compute_nullifier_hash(10);
    let c1_out = compute_amm_commitment(out1_felt, TOKEN_TYPE_STRK, 100, 110);

    start_cheat_caller_address(amm_address, USER1());
    amm.swap(c1, n1, 1000, TOKEN_TYPE_BTC, 1, 10, c1_out, out1_felt, TOKEN_TYPE_STRK, 100, 110);
    stop_cheat_caller_address(amm_address);

    // USER2 deposits and swaps 2000 BTC → STRK (at worse price)
    let btc_r = amm.get_btc_reserve(); // 11000
    let strk_r = amm.get_strk_reserve(); // 50000 - out1

    let c2 = compute_amm_commitment(2000, TOKEN_TYPE_BTC, 2, 20);
    start_cheat_caller_address(amm_address, USER2());
    amm.deposit(TOKEN_TYPE_BTC, 2000, c2);
    stop_cheat_caller_address(amm_address);

    let out2: u256 = (strk_r * 2000_u256) / (btc_r + 2000_u256);
    let out2_felt: felt252 = out2.try_into().unwrap();
    let n2 = compute_nullifier_hash(20);
    let c2_out = compute_amm_commitment(out2_felt, TOKEN_TYPE_STRK, 200, 220);

    start_cheat_caller_address(amm_address, USER2());
    amm.swap(c2, n2, 2000, TOKEN_TYPE_BTC, 2, 20, c2_out, out2_felt, TOKEN_TYPE_STRK, 200, 220);
    stop_cheat_caller_address(amm_address);

    // Both commitments should be valid
    assert!(amm.is_commitment_valid(c1_out), "USER1 output valid");
    assert!(amm.is_commitment_valid(c2_out), "USER2 output valid");
    assert!(amm.get_commitment_count() == 2, "Two active commitments");

    // USER2 got worse price per BTC
    // USER1: out1/1000, USER2: out2/2000
    // Per unit: out1*2000 vs out2*1000 — USER1 should be better
    assert!(out1 * 2000 > out2 * 1000, "USER2 got worse per-unit price");
}

#[test]
fn test_swap_then_reverse_swap() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Swap BTC → STRK
    let c1 = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 1, 10);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, c1);
    stop_cheat_caller_address(amm_address);

    let out1: u256 = (50000_u256 * 1000_u256) / (10000_u256 + 1000_u256);
    let out1_felt: felt252 = out1.try_into().unwrap();
    let n1 = compute_nullifier_hash(10);
    let c1_out = compute_amm_commitment(out1_felt, TOKEN_TYPE_STRK, 100, 110);

    start_cheat_caller_address(amm_address, USER1());
    amm.swap(c1, n1, 1000, TOKEN_TYPE_BTC, 1, 10, c1_out, out1_felt, TOKEN_TYPE_STRK, 100, 110);
    stop_cheat_caller_address(amm_address);

    // Now swap the STRK back → BTC
    let btc_r = amm.get_btc_reserve();
    let strk_r = amm.get_strk_reserve();

    let out2: u256 = (btc_r * out1) / (strk_r + out1);
    let out2_felt: felt252 = out2.try_into().unwrap();
    let n2 = compute_nullifier_hash(110);
    let c2_out = compute_amm_commitment(out2_felt, TOKEN_TYPE_BTC, 200, 220);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            c1_out,
            n2,
            out1_felt,
            TOKEN_TYPE_STRK,
            100,
            110,
            c2_out,
            out2_felt,
            TOKEN_TYPE_BTC,
            200,
            220,
        );
    stop_cheat_caller_address(amm_address);

    // Due to the constant product formula, swapping back gives less than original
    // (this is expected — the AMM keeps the difference as implicit fee via price impact)
    assert!(out2 < 1000, "Round-trip should lose value due to price impact");
    assert!(amm.is_commitment_valid(c2_out), "Final commitment valid");
}

#[test]
fn test_multiple_deposits_same_user() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    let c1 = compute_amm_commitment(500, TOKEN_TYPE_BTC, 1, 10);
    let c2 = compute_amm_commitment(300, TOKEN_TYPE_BTC, 2, 20);
    let c3 = compute_amm_commitment(200, TOKEN_TYPE_STRK, 3, 30);

    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 500, c1);
    amm.deposit(TOKEN_TYPE_BTC, 300, c2);
    amm.deposit(TOKEN_TYPE_STRK, 200, c3);
    stop_cheat_caller_address(amm_address);

    assert!(amm.get_commitment_count() == 3, "Three commitments");
    assert!(amm.is_commitment_valid(c1), "c1 valid");
    assert!(amm.is_commitment_valid(c2), "c2 valid");
    assert!(amm.is_commitment_valid(c3), "c3 valid");
}

#[test]
fn test_deposit_before_seed_allowed() {
    let (_, _, amm_address) = setup();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Deposits should work even before seeding
    let commitment = compute_amm_commitment(500, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 500, commitment);
    stop_cheat_caller_address(amm_address);

    assert!(amm.is_commitment_valid(commitment), "Commitment valid");
    assert!(amm.get_commitment_count() == 1, "Count 1");
}

#[test]
#[should_panic(expected: 'Invalid swap proof')]
fn test_swap_wrong_token_type_in_proof_fails() {
    let (_, _, amm_address, btc_commitment) = setup_with_btc_deposit();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    // Commitment was created with TOKEN_TYPE_BTC, but we claim TOKEN_TYPE_STRK
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment = compute_amm_commitment(100, TOKEN_TYPE_BTC, 200, 300);

    start_cheat_caller_address(amm_address, USER1());
    amm
        .swap(
            btc_commitment,
            nullifier_hash,
            1000,
            TOKEN_TYPE_STRK, // WRONG — commitment was for BTC
            42,
            99,
            new_commitment,
            100,
            TOKEN_TYPE_BTC,
            200,
            300,
        );
    stop_cheat_caller_address(amm_address);
}

#[test]
#[should_panic(expected: 'Same token type')]
fn test_get_amount_out_same_token_fails() {
    let (_, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };

    amm.get_amount_out(1000, TOKEN_TYPE_BTC, TOKEN_TYPE_BTC);
}

#[test]
fn test_withdraw_to_different_recipient() {
    let (btc_address, _, amm_address) = setup_seeded();
    let amm = IShieldedAMMDispatcher { contract_address: amm_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };

    let user2_balance_before = btc_erc20.balance_of(USER2());

    // USER1 deposits
    let commitment = compute_amm_commitment(1000, TOKEN_TYPE_BTC, 42, 99);
    start_cheat_caller_address(amm_address, USER1());
    amm.deposit(TOKEN_TYPE_BTC, 1000, commitment);
    stop_cheat_caller_address(amm_address);

    // USER1 withdraws to USER2
    let nullifier_hash = compute_nullifier_hash(99);
    start_cheat_caller_address(amm_address, USER1());
    amm.withdraw(commitment, nullifier_hash, 1000, TOKEN_TYPE_BTC, 42, 99, USER2(), 1000);
    stop_cheat_caller_address(amm_address);

    assert!(
        btc_erc20.balance_of(USER2()) == user2_balance_before + 1000, "USER2 received tokens",
    );
}
