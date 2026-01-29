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

fn USER2() -> ContractAddress {
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

fn setup_with_deposit() -> (ContractAddress, ContractAddress) {
    let (btc_address, pool_address) = setup();

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

    (btc_address, pool_address)
}

#[test]
fn test_basic_withdraw() {
    let (btc_address, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Verify pre-conditions
    assert!(pool.get_commitment_count() == 1, "Count should be 1 before withdraw");
    assert!(pool.get_total_deposited() == 1000, "Total should be 1000 before withdraw");
    assert!(erc20.balance_of(USER1()) == 9000, "User should have 9000 before withdraw");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool should have 1000 before withdraw");

    let commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment, nullifier_hash, 1000, 42, 99, USER1(), 1000);
    stop_cheat_caller_address(pool_address);

    // Commitment should be invalidated
    assert!(!pool.is_commitment_valid(commitment), "Commitment should be invalid after withdraw");

    // Nullifier should be marked as used
    assert!(pool.is_nullifier_used(nullifier_hash), "Nullifier should be used after withdraw");

    // Tokens should be sent to recipient
    assert!(erc20.balance_of(USER1()) == 10000, "User should have 10000 after withdraw");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0 after withdraw");

    // Commitment count should be decremented
    assert!(pool.get_commitment_count() == 0, "Count should be 0 after withdraw");

    // Total deposited should be decremented
    assert!(pool.get_total_deposited() == 0, "Total should be 0 after withdraw");
}

#[test]
fn test_withdraw_to_different_recipient() {
    let (btc_address, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    // USER2 starts with 0 tokens
    assert!(erc20.balance_of(USER2()) == 0, "USER2 should have 0 before withdraw");

    let commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    // USER1 deposited, but withdraws to USER2
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment, nullifier_hash, 1000, 42, 99, USER2(), 1000);
    stop_cheat_caller_address(pool_address);

    // USER2 receives the tokens
    assert!(erc20.balance_of(USER2()) == 1000, "USER2 should have 1000 after withdraw");

    // USER1 still has 9000 (deposited 1000 from 10000, didn't get them back)
    assert!(erc20.balance_of(USER1()) == 9000, "USER1 should still have 9000");

    // Pool balance should be 0
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0 after withdraw");

    // Pool state should be updated
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_total_deposited() == 0, "Total should be 0");
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_withdraw_nonexistent_commitment() {
    let (_, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    // Try to withdraw a commitment that was never deposited
    let fake_commitment = compute_commitment(1000, 999, 888);
    let nullifier_hash = compute_nullifier_hash(888);

    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(fake_commitment, nullifier_hash, 1000, 999, 888, USER1(), 1000);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_withdraw_double_spend() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    // Deposit two separate commitments that share the same nullifier_secret
    // This lets us test that the nullifier check fires on the second withdraw
    let commitment1 = compute_commitment(500, 42, 99);
    let commitment2 = compute_commitment(500, 77, 99); // same nullifier_secret=99

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(500, commitment1);
    pool.deposit(500, commitment2);
    stop_cheat_caller_address(pool_address);

    let nullifier_hash = compute_nullifier_hash(99);

    // First withdraw succeeds (commitment1)
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment1, nullifier_hash, 500, 42, 99, USER1(), 500);
    stop_cheat_caller_address(pool_address);

    // Second withdraw with same nullifier should fail, even though commitment2 is valid
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment2, nullifier_hash, 500, 77, 99, USER1(), 500);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Invalid withdraw proof')]
fn test_withdraw_wrong_secret() {
    let (_, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    // Try to withdraw with wrong secret (999 instead of 42)
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment, nullifier_hash, 1000, 999, 99, USER1(), 1000);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Invalid withdraw proof')]
fn test_withdraw_wrong_nullifier_secret() {
    let (_, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    // Try to withdraw with wrong nullifier_secret (88 instead of 99)
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment, nullifier_hash, 1000, 42, 88, USER1(), 1000);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Invalid withdraw proof')]
fn test_withdraw_wrong_amount() {
    let (_, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    // Try to withdraw with wrong amount (500 instead of 1000) -- partial withdraw not supported
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment, nullifier_hash, 500, 42, 99, USER1(), 500);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Invalid withdraw proof')]
fn test_withdraw_zero_amount() {
    let (_, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash = compute_nullifier_hash(99);

    // Try to withdraw with amount=0
    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(commitment, nullifier_hash, 0, 42, 99, USER1(), 0);
    stop_cheat_caller_address(pool_address);
}

#[test]
fn test_withdraw_after_transfer() {
    let (btc_address, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    // Deposit was 1000 with secret=42, nullifier_secret=99
    let old_commitment = compute_commitment(1000, 42, 99);
    let nullifier_hash_transfer = compute_nullifier_hash(99);

    // Transfer: sender keeps 700, sends 300
    let sender_change = compute_commitment(700, 100, 200);
    let recipient_commitment = compute_commitment(300, 101, 201);

    start_cheat_caller_address(pool_address, USER1());
    pool
        .transfer(
            old_commitment,
            nullifier_hash_transfer,
            1000, 42, 99,
            sender_change,
            recipient_commitment,
            700, 300,
            100, 200, 101, 201,
        );
    stop_cheat_caller_address(pool_address);

    // Now withdraw the 700 change commitment
    let nullifier_hash_withdraw = compute_nullifier_hash(200);

    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(sender_change, nullifier_hash_withdraw, 700, 100, 200, USER1(), 700);
    stop_cheat_caller_address(pool_address);

    // Commitment should be invalidated
    assert!(!pool.is_commitment_valid(sender_change), "Change commitment should be invalid");

    // Nullifier should be used
    assert!(
        pool.is_nullifier_used(nullifier_hash_withdraw),
        "Withdraw nullifier should be used",
    );

    // Tokens returned to user
    assert!(erc20.balance_of(USER1()) == 9700, "User should have 9700 after withdrawing 700");
    assert!(erc20.balance_of(pool_address) == 300, "Pool should have 300 remaining");

    // Pool state: started with 1 deposit, transfer made 2, withdraw removed 1 => 1 remaining
    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_total_deposited() == 300, "Total deposited should be 300");

    // The recipient commitment should still be valid
    assert!(
        pool.is_commitment_valid(recipient_commitment),
        "Recipient commitment should still be valid",
    );
}

#[test]
fn test_withdraw_received_transfer() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    // Mint tokens for Alice and set up approvals
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    // Alice deposits 1000
    let alice_commitment = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(1000, alice_commitment);
    stop_cheat_caller_address(pool_address);

    // Alice transfers 300 to Bob's commitment
    let nullifier_hash_transfer = compute_nullifier_hash(22);
    let alice_change = compute_commitment(700, 33, 44);
    let bob_commitment = compute_commitment(300, 55, 66);

    start_cheat_caller_address(pool_address, USER1());
    pool
        .transfer(
            alice_commitment,
            nullifier_hash_transfer,
            1000, 11, 22,
            alice_change,
            bob_commitment,
            700, 300,
            33, 44, 55, 66,
        );
    stop_cheat_caller_address(pool_address);

    // Bob withdraws his 300 to USER2 address
    let bob_nullifier_hash = compute_nullifier_hash(66);

    start_cheat_caller_address(pool_address, USER2());
    pool.withdraw(bob_commitment, bob_nullifier_hash, 300, 55, 66, USER2(), 300);
    stop_cheat_caller_address(pool_address);

    // Bob (USER2) receives 300 tokens
    assert!(erc20.balance_of(USER2()) == 300, "Bob should have 300 after withdraw");

    // Pool still has 700 (Alice's change)
    assert!(erc20.balance_of(pool_address) == 700, "Pool should have 700 remaining");

    // Bob's commitment is invalidated
    assert!(!pool.is_commitment_valid(bob_commitment), "Bob commitment should be invalid");

    // Alice's change commitment is still valid
    assert!(pool.is_commitment_valid(alice_change), "Alice change should still be valid");

    // Nullifier used
    assert!(pool.is_nullifier_used(bob_nullifier_hash), "Bob nullifier should be used");

    // Pool state
    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_total_deposited() == 700, "Total deposited should be 700");
}

#[test]
fn test_multiple_deposits_withdraw_one() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    // Deposit 3 commitments
    let c1 = compute_commitment(500, 1, 10);
    let c2 = compute_commitment(300, 2, 20);
    let c3 = compute_commitment(200, 3, 30);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(500, c1);
    pool.deposit(300, c2);
    pool.deposit(200, c3);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 3, "Count should be 3 after deposits");
    assert!(pool.get_total_deposited() == 1000, "Total should be 1000 after deposits");

    // Withdraw only c2 (300)
    let n2 = compute_nullifier_hash(20);

    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(c2, n2, 300, 2, 20, USER1(), 300);
    stop_cheat_caller_address(pool_address);

    // c2 should be invalidated, c1 and c3 still valid
    assert!(pool.is_commitment_valid(c1), "c1 should still be valid");
    assert!(!pool.is_commitment_valid(c2), "c2 should be invalid after withdraw");
    assert!(pool.is_commitment_valid(c3), "c3 should still be valid");

    // Nullifier used
    assert!(pool.is_nullifier_used(n2), "Nullifier for c2 should be used");

    // Counts
    assert!(pool.get_commitment_count() == 2, "Count should be 2 after one withdraw");
    assert!(pool.get_total_deposited() == 700, "Total should be 700 after withdrawing 300");

    // Balances
    assert!(erc20.balance_of(USER1()) == 9300, "User should have 9300");
    assert!(erc20.balance_of(pool_address) == 700, "Pool should have 700");
}

#[test]
fn test_withdraw_all_deposits() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    // Deposit 3 commitments
    let c1 = compute_commitment(500, 1, 10);
    let c2 = compute_commitment(300, 2, 20);
    let c3 = compute_commitment(200, 3, 30);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(500, c1);
    pool.deposit(300, c2);
    pool.deposit(200, c3);
    stop_cheat_caller_address(pool_address);

    // Withdraw all three
    let n1 = compute_nullifier_hash(10);
    let n2 = compute_nullifier_hash(20);
    let n3 = compute_nullifier_hash(30);

    start_cheat_caller_address(pool_address, USER1());
    pool.withdraw(c1, n1, 500, 1, 10, USER1(), 500);
    pool.withdraw(c2, n2, 300, 2, 20, USER1(), 300);
    pool.withdraw(c3, n3, 200, 3, 30, USER1(), 200);
    stop_cheat_caller_address(pool_address);

    // All commitments invalid
    assert!(!pool.is_commitment_valid(c1), "c1 should be invalid");
    assert!(!pool.is_commitment_valid(c2), "c2 should be invalid");
    assert!(!pool.is_commitment_valid(c3), "c3 should be invalid");

    // All nullifiers used
    assert!(pool.is_nullifier_used(n1), "n1 should be used");
    assert!(pool.is_nullifier_used(n2), "n2 should be used");
    assert!(pool.is_nullifier_used(n3), "n3 should be used");

    // Pool balance zero
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0");

    // User got all tokens back
    assert!(erc20.balance_of(USER1()) == 10000, "User should have 10000");

    // Pool state
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_total_deposited() == 0, "Total should be 0");
}
