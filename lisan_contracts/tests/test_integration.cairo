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

#[test]
fn test_full_deposit_transfer_withdraw_flow() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    // Mint tokens for Alice
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    stop_cheat_caller_address(btc_address);

    // Alice approves pool
    start_cheat_caller_address(btc_address, ALICE());
    erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    // --- Step 1: Alice deposits 1000 ---
    let alice_commitment = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, alice_commitment);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4000, "Alice should have 4000 after deposit");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool should have 1000 after deposit");
    assert!(pool.get_commitment_count() == 1, "Count should be 1 after deposit");
    assert!(pool.get_total_deposited() == 1000, "Total should be 1000 after deposit");

    // --- Step 2: Alice transfers 400 to Bob (keeps 600) ---
    let nullifier_transfer = compute_nullifier_hash(22);
    let alice_change = compute_commitment(600, 33, 44);
    let bob_commitment = compute_commitment(400, 55, 66);

    start_cheat_caller_address(pool_address, ALICE());
    pool
        .transfer(
            alice_commitment,
            nullifier_transfer,
            1000, 11, 22,
            alice_change,
            bob_commitment,
            600, 400,
            33, 44, 55, 66,
        );
    stop_cheat_caller_address(pool_address);

    assert!(!pool.is_commitment_valid(alice_commitment), "Old Alice commitment should be invalid");
    assert!(pool.is_commitment_valid(alice_change), "Alice change should be valid");
    assert!(pool.is_commitment_valid(bob_commitment), "Bob commitment should be valid");
    assert!(pool.get_commitment_count() == 2, "Count should be 2 after transfer");
    assert!(pool.get_total_deposited() == 1000, "Total should still be 1000 after transfer");
    assert!(
        pool.is_nullifier_used(nullifier_transfer),
        "Transfer nullifier should be used",
    );

    // --- Step 3: Alice withdraws her 600 change ---
    let alice_withdraw_nullifier = compute_nullifier_hash(44);

    start_cheat_caller_address(pool_address, ALICE());
    pool.withdraw(alice_change, alice_withdraw_nullifier, 600, 33, 44, ALICE(), 600);
    stop_cheat_caller_address(pool_address);

    assert!(!pool.is_commitment_valid(alice_change), "Alice change should be invalid after withdraw");
    assert!(
        pool.is_nullifier_used(alice_withdraw_nullifier),
        "Alice withdraw nullifier should be used",
    );
    assert!(erc20.balance_of(ALICE()) == 4600, "Alice should have 4600 after withdrawing 600");
    assert!(erc20.balance_of(pool_address) == 400, "Pool should have 400 after Alice withdraw");
    assert!(pool.get_commitment_count() == 1, "Count should be 1 after Alice withdraw");
    assert!(pool.get_total_deposited() == 400, "Total should be 400 after Alice withdraw");

    // --- Step 4: Bob withdraws his 400 ---
    let bob_withdraw_nullifier = compute_nullifier_hash(66);

    start_cheat_caller_address(pool_address, BOB());
    pool.withdraw(bob_commitment, bob_withdraw_nullifier, 400, 55, 66, BOB(), 400);
    stop_cheat_caller_address(pool_address);

    assert!(!pool.is_commitment_valid(bob_commitment), "Bob commitment should be invalid after withdraw");
    assert!(
        pool.is_nullifier_used(bob_withdraw_nullifier),
        "Bob withdraw nullifier should be used",
    );
    assert!(erc20.balance_of(BOB()) == 400, "Bob should have 400 after withdraw");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should have 0 after all withdrawals");
    assert!(pool.get_commitment_count() == 0, "Count should be 0 after all withdrawals");
    assert!(pool.get_total_deposited() == 0, "Total should be 0 after all withdrawals");

    // --- Final assertions: all tokens back in user wallets, pool empty ---
    assert!(erc20.balance_of(ALICE()) == 4600, "Alice final balance should be 4600");
    assert!(erc20.balance_of(BOB()) == 400, "Bob final balance should be 400");
    assert!(erc20.balance_of(pool_address) == 0, "Pool final balance should be 0");

    // All commitments invalid
    assert!(!pool.is_commitment_valid(alice_commitment), "Original Alice commitment invalid");
    assert!(!pool.is_commitment_valid(alice_change), "Alice change invalid");
    assert!(!pool.is_commitment_valid(bob_commitment), "Bob commitment invalid");

    // All nullifiers used
    assert!(pool.is_nullifier_used(nullifier_transfer), "Transfer nullifier used");
    assert!(pool.is_nullifier_used(alice_withdraw_nullifier), "Alice withdraw nullifier used");
    assert!(pool.is_nullifier_used(bob_withdraw_nullifier), "Bob withdraw nullifier used");
}

#[test]
fn test_chained_transfers_then_withdraw_all() {
    // Deposit → Transfer → Transfer from change → Withdraw all remaining commitments
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

    // Alice deposits 1000
    let c1 = compute_commitment(1000, 1, 2);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, c1);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4000, "Alice should have 4000 after deposit");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool should have 1000");

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

    assert!(pool.get_commitment_count() == 2, "Count should be 2 after first transfer");

    // Transfer 2: Alice sends 200 more from her 600 change, keeps 400
    let n2 = compute_nullifier_hash(4);
    let c3_alice = compute_commitment(400, 7, 8);
    let c3_bob = compute_commitment(200, 9, 10);

    pool
        .transfer(
            c2_alice, n2, 600, 3, 4,
            c3_alice, c3_bob,
            400, 200, 7, 8, 9, 10,
        );

    assert!(pool.get_commitment_count() == 3, "Count should be 3 after second transfer");
    // Active commitments: c2_bob(400), c3_alice(400), c3_bob(200) = 1000 total

    // Now withdraw all three remaining commitments
    // Withdraw c3_alice (Alice's 400 change)
    let n_alice_withdraw = compute_nullifier_hash(8);
    start_cheat_caller_address(pool_address, ALICE());
    pool.withdraw(c3_alice, n_alice_withdraw, 400, 7, 8, ALICE(), 400);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4400, "Alice should have 4400 after withdrawing 400");
    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_total_deposited() == 600, "Total should be 600");

    // Withdraw c2_bob (Bob's first received 400)
    let n_bob_withdraw1 = compute_nullifier_hash(6);
    start_cheat_caller_address(pool_address, BOB());
    pool.withdraw(c2_bob, n_bob_withdraw1, 400, 5, 6, BOB(), 400);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(BOB()) == 400, "Bob should have 400 after first withdraw");
    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_total_deposited() == 200, "Total should be 200");

    // Withdraw c3_bob (Bob's second received 200)
    let n_bob_withdraw2 = compute_nullifier_hash(10);
    start_cheat_caller_address(pool_address, BOB());
    pool.withdraw(c3_bob, n_bob_withdraw2, 200, 9, 10, BOB(), 200);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(BOB()) == 600, "Bob should have 600 total");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should be empty");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_total_deposited() == 0, "Total should be 0");

    // Verify total conservation: Alice started with 5000, deposited 1000, got back 400 = 4400
    // Bob started with 0, got 400 + 200 = 600
    // 4400 + 600 = 5000 = original supply
    assert!(erc20.balance_of(ALICE()) == 4400, "Alice final balance 4400");
    assert!(erc20.balance_of(BOB()) == 600, "Bob final balance 600");

    // All nullifiers marked used
    assert!(pool.is_nullifier_used(n1), "Transfer 1 nullifier used");
    assert!(pool.is_nullifier_used(n2), "Transfer 2 nullifier used");
    assert!(pool.is_nullifier_used(n_alice_withdraw), "Alice withdraw nullifier used");
    assert!(pool.is_nullifier_used(n_bob_withdraw1), "Bob withdraw 1 nullifier used");
    assert!(pool.is_nullifier_used(n_bob_withdraw2), "Bob withdraw 2 nullifier used");
}

#[test]
fn test_multiple_users_deposit_transfer_withdraw() {
    // Both Alice and Bob deposit, Alice transfers to Bob, then everyone withdraws everything
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

    // Alice deposits 1000
    let alice_c = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, alice_c);
    stop_cheat_caller_address(pool_address);

    // Bob deposits 500
    let bob_c = compute_commitment(500, 33, 44);
    start_cheat_caller_address(pool_address, BOB());
    pool.deposit(500, bob_c);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 2, "Count should be 2 after deposits");
    assert!(pool.get_total_deposited() == 1500, "Total should be 1500");
    assert!(erc20.balance_of(pool_address) == 1500, "Pool should hold 1500");

    // Alice transfers 300 to Bob (keeps 700)
    let n_alice = compute_nullifier_hash(22);
    let alice_change = compute_commitment(700, 55, 66);
    let bob_received = compute_commitment(300, 77, 88);

    start_cheat_caller_address(pool_address, ALICE());
    pool
        .transfer(
            alice_c, n_alice, 1000, 11, 22,
            alice_change, bob_received,
            700, 300, 55, 66, 77, 88,
        );
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 3, "Count should be 3 after transfer");
    // Active: alice_change(700), bob_received(300), bob_c(500) = 1500

    // Alice withdraws her 700 change
    let n_alice_w = compute_nullifier_hash(66);
    start_cheat_caller_address(pool_address, ALICE());
    pool.withdraw(alice_change, n_alice_w, 700, 55, 66, ALICE(), 700);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4700, "Alice should have 4700");
    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_total_deposited() == 800, "Total should be 800");

    // Bob withdraws his received 300
    let n_bob_received_w = compute_nullifier_hash(88);
    start_cheat_caller_address(pool_address, BOB());
    pool.withdraw(bob_received, n_bob_received_w, 300, 77, 88, BOB(), 300);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(BOB()) == 2800, "Bob should have 2800");
    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_total_deposited() == 500, "Total should be 500");

    // Bob withdraws his original 500 deposit
    let n_bob_orig_w = compute_nullifier_hash(44);
    start_cheat_caller_address(pool_address, BOB());
    pool.withdraw(bob_c, n_bob_orig_w, 500, 33, 44, BOB(), 500);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(BOB()) == 3300, "Bob should have 3300");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should be empty");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_total_deposited() == 0, "Total should be 0");

    // Conservation check: Alice had 5000, deposited 1000, got back 700 = 4700
    // Bob had 3000, deposited 500, got back 300 + 500 = 3300
    // 4700 + 3300 = 8000 = 5000 + 3000 = original total
    assert!(erc20.balance_of(ALICE()) == 4700, "Alice final 4700");
    assert!(erc20.balance_of(BOB()) == 3300, "Bob final 3300");
}

#[test]
fn test_three_hop_transfer_then_withdraw() {
    // Deposit → Transfer to Bob → Bob transfers to Charlie → Charlie withdraws
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    let charlie: ContractAddress = 0x4.try_into().unwrap();

    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, ALICE());
    erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    // Alice deposits 1000
    let c_alice = compute_commitment(1000, 10, 20);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, c_alice);
    stop_cheat_caller_address(pool_address);

    // Hop 1: Alice transfers 600 to Bob (keeps 400)
    let n1 = compute_nullifier_hash(20);
    let c_alice_change = compute_commitment(400, 30, 40);
    let c_bob = compute_commitment(600, 50, 60);

    pool
        .transfer(
            c_alice, n1, 1000, 10, 20,
            c_alice_change, c_bob,
            400, 600, 30, 40, 50, 60,
        );

    // Hop 2: Bob transfers 250 to Charlie (keeps 350)
    let n2 = compute_nullifier_hash(60);
    let c_bob_change = compute_commitment(350, 70, 80);
    let c_charlie = compute_commitment(250, 90, 100);

    pool
        .transfer(
            c_bob, n2, 600, 50, 60,
            c_bob_change, c_charlie,
            350, 250, 70, 80, 90, 100,
        );

    assert!(pool.get_commitment_count() == 3, "Count should be 3");
    // Active: c_alice_change(400), c_bob_change(350), c_charlie(250)

    // Charlie withdraws his 250
    let n_charlie_w = compute_nullifier_hash(100);
    start_cheat_caller_address(pool_address, charlie);
    pool.withdraw(c_charlie, n_charlie_w, 250, 90, 100, charlie, 250);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(charlie) == 250, "Charlie should have 250");
    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_total_deposited() == 750, "Total should be 750");

    // Bob withdraws his 350 change
    let n_bob_w = compute_nullifier_hash(80);
    start_cheat_caller_address(pool_address, BOB());
    pool.withdraw(c_bob_change, n_bob_w, 350, 70, 80, BOB(), 350);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(BOB()) == 350, "Bob should have 350");
    assert!(pool.get_commitment_count() == 1, "Count should be 1");

    // Alice withdraws her 400 change
    let n_alice_w = compute_nullifier_hash(40);
    start_cheat_caller_address(pool_address, ALICE());
    pool.withdraw(c_alice_change, n_alice_w, 400, 30, 40, ALICE(), 400);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4400, "Alice should have 4400");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should be empty");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_total_deposited() == 0, "Total should be 0");

    // Conservation: 4400 + 350 + 250 = 5000 = original mint
    let total = erc20.balance_of(ALICE()) + erc20.balance_of(BOB()) + erc20.balance_of(charlie);
    assert!(total == 5000, "Total conservation violated");
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_withdraw_commitment_already_consumed_by_transfer() {
    // Deposit, then transfer (consuming the commitment), then try to withdraw the same commitment
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

    let c1 = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, c1);
    stop_cheat_caller_address(pool_address);

    // Transfer consumes c1
    let n1 = compute_nullifier_hash(22);
    let c_sender = compute_commitment(600, 33, 44);
    let c_recipient = compute_commitment(400, 55, 66);

    pool
        .transfer(
            c1, n1, 1000, 11, 22,
            c_sender, c_recipient,
            600, 400, 33, 44, 55, 66,
        );

    // Now try to withdraw c1 which was already consumed by the transfer
    let n_withdraw = compute_nullifier_hash(22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.withdraw(c1, n_withdraw, 1000, 11, 22, ALICE(), 1000);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Commitment does not exist')]
fn test_transfer_commitment_already_consumed_by_withdraw() {
    // Deposit, then withdraw (consuming the commitment), then try to transfer using the same commitment
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

    let c1 = compute_commitment(1000, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(1000, c1);
    stop_cheat_caller_address(pool_address);

    // Withdraw c1 first
    let n_withdraw = compute_nullifier_hash(22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.withdraw(c1, n_withdraw, 1000, 11, 22, ALICE(), 1000);
    stop_cheat_caller_address(pool_address);

    // Now try to transfer using the already-withdrawn c1
    let n_transfer = compute_nullifier_hash(22);
    let c_sender = compute_commitment(600, 33, 44);
    let c_recipient = compute_commitment(400, 55, 66);

    pool
        .transfer(
            c1, n_transfer, 1000, 11, 22,
            c_sender, c_recipient,
            600, 400, 33, 44, 55, 66,
        );
}
