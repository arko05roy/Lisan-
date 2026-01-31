use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::mock_strk::{IMockSTRKDispatcher, IMockSTRKDispatcherTrait};
use lisan_contracts::shielded_pool::{IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait};
use lisan_contracts::commitment::{compute_pool_commitment, compute_nullifier_hash};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn USER2() -> ContractAddress {
    0x3.try_into().unwrap()
}

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

    // Deploy mock verifiers
    let verifier_class = declare("MockGroth16Verifier").unwrap().contract_class();
    let mut wv_calldata = array![4];
    let (withdraw_verifier, _) = verifier_class.deploy(@wv_calldata).unwrap();
    let mut tv_calldata = array![4];
    let (transfer_verifier, _) = verifier_class.deploy(@tv_calldata).unwrap();

    // Deploy ShieldedPool
    let pool_class = declare("ShieldedPool").unwrap().contract_class();
    let mut pool_calldata = array![];
    withdraw_verifier.serialize(ref pool_calldata);
    transfer_verifier.serialize(ref pool_calldata);
    let (pool_address, _) = pool_class.deploy(@pool_calldata).unwrap();

    (btc_address, strk_address, pool_address)
}

fn setup_with_btc_deposit() -> (ContractAddress, ContractAddress, ContractAddress) {
    let (btc_address, strk_address, pool_address) = setup();

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let token_felt: felt252 = btc_address.into();
    let commitment = compute_pool_commitment(1000, token_felt, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 1000, commitment);
    stop_cheat_caller_address(pool_address);

    (btc_address, strk_address, pool_address)
}

/// Build mock proof (full_proof_with_hints) for pool withdraw.
/// MockGroth16Verifier reads these as public inputs: [root, nullifier, tokenAddress, amount]
fn build_withdraw_proof(
    root: felt252, nullifier_hash: felt252, token_address: felt252, amount: felt252,
) -> Array<felt252> {
    array![root, nullifier_hash, token_address, amount]
}

#[test]
fn test_basic_withdraw_btc() {
    let (btc_address, _, pool_address) = setup_with_btc_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    assert!(pool.get_commitment_count() == 1, "Count should be 1 before withdraw");
    assert!(pool.get_token_balance(btc_address) == 1000, "Token balance should be 1000");

    let nullifier_hash = compute_nullifier_hash(99);
    let root = pool.get_last_root();
    let token_felt: felt252 = btc_address.into();

    let proof = build_withdraw_proof(root, nullifier_hash, token_felt, 1000);

    // Phase 1: prepare_withdraw
    pool.prepare_withdraw(proof.span(), root, nullifier_hash, btc_address, 1000);

    assert!(pool.is_nullifier_used(nullifier_hash), "Nullifier should be used");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_token_balance(btc_address) == 0, "Token balance should be 0");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool should still hold tokens");

    // Phase 2: claim_withdrawal
    pool.claim_withdrawal(nullifier_hash, USER1());

    assert!(erc20.balance_of(USER1()) == 10000, "User should have 10000 after claim");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0 after claim");
}

#[test]
fn test_withdraw_to_different_recipient() {
    let (btc_address, _, pool_address) = setup_with_btc_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    assert!(erc20.balance_of(USER2()) == 0, "USER2 should have 0");

    let nullifier_hash = compute_nullifier_hash(99);
    let root = pool.get_last_root();
    let token_felt: felt252 = btc_address.into();

    let proof = build_withdraw_proof(root, nullifier_hash, token_felt, 1000);
    pool.prepare_withdraw(proof.span(), root, nullifier_hash, btc_address, 1000);

    // Claim to USER2
    pool.claim_withdrawal(nullifier_hash, USER2());

    assert!(erc20.balance_of(USER2()) == 1000, "USER2 should have 1000");
    assert!(erc20.balance_of(USER1()) == 9000, "USER1 should have 9000");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0");
}

#[test]
fn test_multi_asset_deposit_withdraw() {
    let (btc_address, strk_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    // Mint and approve both tokens
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let mock_strk = IMockSTRKDispatcher { contract_address: strk_address };
    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(USER1(), 10000);
    stop_cheat_caller_address(strk_address);

    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    btc_erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };
    start_cheat_caller_address(strk_address, USER1());
    strk_erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(strk_address);

    let btc_felt: felt252 = btc_address.into();
    let strk_felt: felt252 = strk_address.into();

    // Deposit BTC and STRK into same pool
    let c1 = compute_pool_commitment(1000, btc_felt, 42, 99);
    let c2 = compute_pool_commitment(500, strk_felt, 43, 100);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 1000, c1);
    pool.deposit(strk_address, 500, c2);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_token_balance(btc_address) == 1000, "BTC balance 1000");
    assert!(pool.get_token_balance(strk_address) == 500, "STRK balance 500");

    // Withdraw BTC
    let n1 = compute_nullifier_hash(99);
    let root = pool.get_last_root();
    let proof1 = build_withdraw_proof(root, n1, btc_felt, 1000);
    pool.prepare_withdraw(proof1.span(), root, n1, btc_address, 1000);
    pool.claim_withdrawal(n1, USER1());

    assert!(btc_erc20.balance_of(USER1()) == 10000, "BTC back to user");
    assert!(pool.get_token_balance(btc_address) == 0, "BTC balance 0");
    assert!(pool.get_token_balance(strk_address) == 500, "STRK balance still 500");

    // Withdraw STRK
    let n2 = compute_nullifier_hash(100);
    let root2 = pool.get_last_root();
    let proof2 = build_withdraw_proof(root2, n2, strk_felt, 500);
    pool.prepare_withdraw(proof2.span(), root2, n2, strk_address, 500);
    pool.claim_withdrawal(n2, USER1());

    assert!(strk_erc20.balance_of(USER1()) == 10000, "STRK back to user");
    assert!(pool.get_token_balance(strk_address) == 0, "STRK balance 0");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_double_spend_fails() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    let token_felt: felt252 = btc_address.into();

    // Deposit two commitments with the same nullifier_secret
    let c1 = compute_pool_commitment(500, token_felt, 42, 99);
    let c2 = compute_pool_commitment(500, token_felt, 77, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 500, c1);
    pool.deposit(btc_address, 500, c2);
    stop_cheat_caller_address(pool_address);

    let nullifier_hash = compute_nullifier_hash(99);
    let root = pool.get_last_root();

    // First withdraw succeeds
    let proof1 = build_withdraw_proof(root, nullifier_hash, token_felt, 500);
    pool.prepare_withdraw(proof1.span(), root, nullifier_hash, btc_address, 500);

    // Second withdraw with same nullifier should fail
    let proof2 = build_withdraw_proof(root, nullifier_hash, token_felt, 500);
    pool.prepare_withdraw(proof2.span(), root, nullifier_hash, btc_address, 500);
}

#[test]
#[should_panic(expected: 'No pending withdrawal')]
fn test_claim_without_prepare_fails() {
    let (_, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let fake_nullifier: felt252 = 12345;
    pool.claim_withdrawal(fake_nullifier, USER1());
}

#[test]
fn test_withdraw_multiple_deposits() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    let token_felt: felt252 = btc_address.into();

    let c1 = compute_pool_commitment(500, token_felt, 1, 10);
    let c2 = compute_pool_commitment(300, token_felt, 2, 20);
    let c3 = compute_pool_commitment(200, token_felt, 3, 30);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 500, c1);
    pool.deposit(btc_address, 300, c2);
    pool.deposit(btc_address, 200, c3);
    stop_cheat_caller_address(pool_address);

    // Withdraw all three
    let n1 = compute_nullifier_hash(10);
    let n2 = compute_nullifier_hash(20);
    let n3 = compute_nullifier_hash(30);

    let root = pool.get_last_root();

    let proof1 = build_withdraw_proof(root, n1, token_felt, 500);
    pool.prepare_withdraw(proof1.span(), root, n1, btc_address, 500);

    let proof2 = build_withdraw_proof(root, n2, token_felt, 300);
    pool.prepare_withdraw(proof2.span(), root, n2, btc_address, 300);

    let proof3 = build_withdraw_proof(root, n3, token_felt, 200);
    pool.prepare_withdraw(proof3.span(), root, n3, btc_address, 200);

    pool.claim_withdrawal(n1, USER1());
    pool.claim_withdrawal(n2, USER1());
    pool.claim_withdrawal(n3, USER1());

    assert!(pool.is_nullifier_used(n1), "n1 should be used");
    assert!(pool.is_nullifier_used(n2), "n2 should be used");
    assert!(pool.is_nullifier_used(n3), "n3 should be used");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0");
    assert!(erc20.balance_of(USER1()) == 10000, "User should have 10000");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_token_balance(btc_address) == 0, "Token balance should be 0");
}
