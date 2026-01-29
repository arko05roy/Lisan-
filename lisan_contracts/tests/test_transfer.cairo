use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::shielded_pool::{IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait};
use lisan_contracts::commitment::{compute_commitment, compute_nullifier_hash};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn setup_with_deposit() -> ContractAddress {
    let btc_class = declare("MockBTC").unwrap().contract_class();
    let mut btc_calldata = array![];
    OWNER().serialize(ref btc_calldata);
    let (btc_address, _) = btc_class.deploy(@btc_calldata).unwrap();

    let pool_class = declare("ShieldedPool").unwrap().contract_class();
    let mut pool_calldata = array![];
    btc_address.serialize(ref pool_calldata);
    let (pool_address, _) = pool_class.deploy(@pool_calldata).unwrap();

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let commitment = compute_commitment(1000, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(1000, commitment);
    stop_cheat_caller_address(pool_address);

    pool_address
}

#[test]
fn test_valid_transfer() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let old_commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    let new_commitment_sender = compute_commitment(700, 100, 200);
    let new_commitment_recipient = compute_commitment(300, 101, 201);

    pool
        .transfer(
            old_commitment,
            nullifier_hash,
            1000, 42, 99,
            new_commitment_sender,
            new_commitment_recipient,
            700, 300,
            100, 200, 101, 201,
        );

    assert!(!pool.is_commitment_valid(old_commitment), "Old should be invalid");
    assert!(pool.is_commitment_valid(new_commitment_sender), "Sender should be valid");
    assert!(pool.is_commitment_valid(new_commitment_recipient), "Recipient should be valid");
    assert!(pool.get_commitment_count() == 2, "Count should be 2");
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_double_spend_prevention() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let old_commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    let new_commitment_sender = compute_commitment(700, 100, 200);
    let new_commitment_recipient = compute_commitment(300, 101, 201);

    pool
        .transfer(
            old_commitment, nullifier_hash,
            1000, 42, 99,
            new_commitment_sender, new_commitment_recipient,
            700, 300, 100, 200, 101, 201,
        );

    let fake_sender = compute_commitment(700, 300, 400);
    let fake_recipient = compute_commitment(300, 301, 401);

    pool
        .transfer(
            old_commitment, nullifier_hash,
            1000, 42, 99,
            fake_sender, fake_recipient,
            700, 300, 300, 400, 301, 401,
        );
}

#[test]
#[should_panic(expected: 'Invalid transfer proof')]
fn test_wrong_secret_fails() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let old_commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment_sender = compute_commitment(700, 100, 200);
    let new_commitment_recipient = compute_commitment(300, 101, 201);

    pool
        .transfer(
            old_commitment, nullifier_hash,
            1000, 999, 99,  // wrong secret
            new_commitment_sender, new_commitment_recipient,
            700, 300, 100, 200, 101, 201,
        );
}

#[test]
#[should_panic(expected: 'Invalid transfer proof')]
fn test_value_not_conserved_fails() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let old_commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    let new_commitment_sender = compute_commitment(800, 100, 200);
    let new_commitment_recipient = compute_commitment(300, 101, 201);

    pool
        .transfer(
            old_commitment, nullifier_hash,
            1000, 42, 99,
            new_commitment_sender, new_commitment_recipient,
            800, 300,  // 800 + 300 != 1000
            100, 200, 101, 201,
        );
}

#[test]
#[should_panic(expected: 'Invalid transfer proof')]
fn test_zero_transfer_amount_fails() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let old_commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    let new_commitment_sender = compute_commitment(1000, 100, 200);
    let new_commitment_recipient = compute_commitment(0, 101, 201);

    pool
        .transfer(
            old_commitment, nullifier_hash,
            1000, 42, 99,
            new_commitment_sender, new_commitment_recipient,
            1000, 0,  // zero transfer
            100, 200, 101, 201,
        );
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_nonexistent_commitment_fails() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let fake_old = compute_commitment(1000, 999, 999);
    let nullifier_hash = compute_nullifier_hash(999);
    let new_commitment_sender = compute_commitment(700, 100, 200);
    let new_commitment_recipient = compute_commitment(300, 101, 201);

    pool
        .transfer(
            fake_old, nullifier_hash,
            1000, 999, 999,
            new_commitment_sender, new_commitment_recipient,
            700, 300, 100, 200, 101, 201,
        );
}

#[test]
#[should_panic(expected: 'Invalid transfer proof')]
fn test_wrong_nullifier_fails() {
    let pool_address = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let old_commitment = compute_commitment(1000, 42, 99);
    let wrong_nullifier_hash = compute_nullifier_hash(88);

    let new_commitment_sender = compute_commitment(700, 100, 200);
    let new_commitment_recipient = compute_commitment(300, 101, 201);

    pool
        .transfer(
            old_commitment, wrong_nullifier_hash,
            1000, 42, 99,
            new_commitment_sender, new_commitment_recipient,
            700, 300, 100, 200, 101, 201,
        );
}
