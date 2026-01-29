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

fn ALICE() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn BOB() -> ContractAddress {
    0x3.try_into().unwrap()
}

fn setup() -> (ContractAddress, ContractAddress) {
    let btc_class = declare("MockBTC").unwrap().contract_class();
    let mut btc_calldata = array![];
    OWNER().serialize(ref btc_calldata);
    let (btc_address, _) = btc_class.deploy(@btc_calldata).unwrap();

    let pool_class = declare("ShieldedPool").unwrap().contract_class();
    let mut pool_calldata = array![];
    btc_address.serialize(ref pool_calldata);
    let (pool_address, _) = pool_class.deploy(@pool_calldata).unwrap();

    (btc_address, pool_address)
}

#[test]
fn test_full_deposit_transfer_flow() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, ALICE());
    erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    let alice_commitment = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, alice_commitment);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4000, "Alice should have 4000");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool should have 1000");
    assert!(pool.get_commitment_count() == 1, "Count should be 1");

    let nullifier_hash = compute_nullifier_hash(22);
    let alice_new_commitment = compute_commitment(600, 33, 44);
    let bob_commitment = compute_commitment(400, 55, 66);

    pool
        .transfer(
            alice_commitment, nullifier_hash,
            1000, 11, 22,
            alice_new_commitment, bob_commitment,
            600, 400, 33, 44, 55, 66,
        );

    assert!(!pool.is_commitment_valid(alice_commitment), "Old should be invalid");
    assert!(pool.is_commitment_valid(alice_new_commitment), "Alice new should be valid");
    assert!(pool.is_commitment_valid(bob_commitment), "Bob should be valid");
    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_total_deposited() == 1000, "Total deposited unchanged");
}

#[test]
fn test_chained_transfers() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, ALICE());
    erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    let c1 = compute_commitment(1000, 1, 2);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, c1);
    stop_cheat_caller_address(pool_address);

    // Transfer 1: Alice sends 400 to Bob, keeps 600
    let n1 = compute_nullifier_hash(2);
    let c2_alice = compute_commitment(600, 3, 4);
    let c2_bob = compute_commitment(400, 5, 6);

    pool
        .transfer(
            c1, n1, 1000, 1, 2,
            c2_alice, c2_bob,
            600, 400, 3, 4, 5, 6,
        );

    // Transfer 2: Alice sends 200 more from her change
    let n2 = compute_nullifier_hash(4);
    let c3_alice = compute_commitment(400, 7, 8);
    let c3_bob = compute_commitment(200, 9, 10);

    pool
        .transfer(
            c2_alice, n2, 600, 3, 4,
            c3_alice, c3_bob,
            400, 200, 7, 8, 9, 10,
        );

    assert!(!pool.is_commitment_valid(c1), "c1 should be invalid");
    assert!(!pool.is_commitment_valid(c2_alice), "c2_alice should be invalid");
    assert!(pool.is_commitment_valid(c2_bob), "c2_bob should be valid");
    assert!(pool.is_commitment_valid(c3_alice), "c3_alice should be valid");
    assert!(pool.is_commitment_valid(c3_bob), "c3_bob should be valid");
    assert!(pool.get_commitment_count() == 3, "Count should be 3");
}

#[test]
fn test_multiple_users() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    mock_btc.mint(BOB(), 3000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, ALICE());
    erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, BOB());
    erc20.approve(pool_address, 3000);
    stop_cheat_caller_address(btc_address);

    let alice_c = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, alice_c);
    stop_cheat_caller_address(pool_address);

    let bob_c = compute_commitment(500, 33, 44);
    start_cheat_caller_address(pool_address, BOB());
    pool.deposit(500, bob_c);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_total_deposited() == 1500, "Total should be 1500");
    assert!(erc20.balance_of(ALICE()) == 4000, "Alice should have 4000");
    assert!(erc20.balance_of(BOB()) == 2500, "Bob should have 2500");
    assert!(erc20.balance_of(pool_address) == 1500, "Pool should have 1500");

    let n_alice = compute_nullifier_hash(22);
    let alice_new = compute_commitment(700, 55, 66);
    let bob_received = compute_commitment(300, 77, 88);

    pool
        .transfer(
            alice_c, n_alice, 1000, 11, 22,
            alice_new, bob_received,
            700, 300, 55, 66, 77, 88,
        );

    assert!(pool.get_commitment_count() == 3, "Count should be 3");
    assert!(pool.is_commitment_valid(alice_new), "Alice new should be valid");
    assert!(pool.is_commitment_valid(bob_received), "Bob received should be valid");
    assert!(pool.is_commitment_valid(bob_c), "Bob original should be valid");
}
