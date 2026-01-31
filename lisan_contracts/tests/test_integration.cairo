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

fn ALICE() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn BOB() -> ContractAddress {
    0x3.try_into().unwrap()
}

fn build_withdraw_proof(
    root: felt252, nullifier_hash: felt252, token_address: felt252, amount: felt252,
) -> Array<felt252> {
    array![root, nullifier_hash, token_address, amount]
}

fn build_transfer_proof(
    root: felt252,
    nullifier_hash: felt252,
    new_commitment_sender: felt252,
    new_commitment_recipient: felt252,
) -> Array<felt252> {
    array![root, nullifier_hash, new_commitment_sender, new_commitment_recipient]
}

fn setup() -> (ContractAddress, ContractAddress, ContractAddress) {
    let btc_class = declare("MockBTC").unwrap().contract_class();
    let mut btc_calldata = array![];
    OWNER().serialize(ref btc_calldata);
    let (btc_address, _) = btc_class.deploy(@btc_calldata).unwrap();

    let strk_class = declare("MockSTRK").unwrap().contract_class();
    let mut strk_calldata = array![];
    OWNER().serialize(ref strk_calldata);
    let (strk_address, _) = strk_class.deploy(@strk_calldata).unwrap();

    let verifier_class = declare("MockGroth16Verifier").unwrap().contract_class();
    let mut wv_calldata = array![4];
    let (withdraw_verifier, _) = verifier_class.deploy(@wv_calldata).unwrap();
    let mut tv_calldata = array![4];
    let (transfer_verifier, _) = verifier_class.deploy(@tv_calldata).unwrap();

    let pool_class = declare("ShieldedPool").unwrap().contract_class();
    let mut pool_calldata = array![];
    withdraw_verifier.serialize(ref pool_calldata);
    transfer_verifier.serialize(ref pool_calldata);
    let (pool_address, _) = pool_class.deploy(@pool_calldata).unwrap();

    (btc_address, strk_address, pool_address)
}

#[test]
fn test_full_deposit_transfer_withdraw_btc() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    // Mint tokens for Alice
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, ALICE());
    erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    let token_felt: felt252 = btc_address.into();

    // --- Step 1: Alice deposits 1000 BTC ---
    let alice_commitment = compute_pool_commitment(1000, token_felt, 11, 22);
    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(btc_address, 1000, alice_commitment);
    stop_cheat_caller_address(pool_address);

    assert!(erc20.balance_of(ALICE()) == 4000, "Alice should have 4000");
    assert!(pool.get_token_balance(btc_address) == 1000, "Pool BTC balance 1000");

    // --- Step 2: Alice transfers 400 to Bob (keeps 600) ---
    let nullifier_transfer = compute_nullifier_hash(22);
    let alice_change = compute_pool_commitment(600, token_felt, 33, 44);
    let bob_commitment = compute_pool_commitment(400, token_felt, 55, 66);

    let root = pool.get_last_root();
    let transfer_proof = build_transfer_proof(root, nullifier_transfer, alice_change, bob_commitment);

    pool.transfer(transfer_proof.span(), root, nullifier_transfer, alice_change, bob_commitment);

    assert!(pool.is_nullifier_used(nullifier_transfer), "Transfer nullifier should be used");
    assert!(pool.get_commitment_count() == 2, "Count should be 2 after transfer");

    // --- Step 3: Alice withdraws her 600 change ---
    let alice_withdraw_nullifier = compute_nullifier_hash(44);
    let root2 = pool.get_last_root();
    let withdraw_proof = build_withdraw_proof(root2, alice_withdraw_nullifier, token_felt, 600);

    pool.prepare_withdraw(
        withdraw_proof.span(), root2, alice_withdraw_nullifier, btc_address, 600,
    );
    pool.claim_withdrawal(alice_withdraw_nullifier, ALICE());

    assert!(erc20.balance_of(ALICE()) == 4600, "Alice should have 4600");
    assert!(pool.get_token_balance(btc_address) == 400, "Pool BTC balance 400");

    // --- Step 4: Bob withdraws his 400 ---
    let bob_withdraw_nullifier = compute_nullifier_hash(66);
    let root3 = pool.get_last_root();
    let bob_proof = build_withdraw_proof(root3, bob_withdraw_nullifier, token_felt, 400);

    pool.prepare_withdraw(bob_proof.span(), root3, bob_withdraw_nullifier, btc_address, 400);
    pool.claim_withdrawal(bob_withdraw_nullifier, BOB());

    assert!(erc20.balance_of(BOB()) == 400, "Bob should have 400");
    assert!(erc20.balance_of(pool_address) == 0, "Pool should be empty");
    assert!(pool.get_commitment_count() == 0, "Count should be 0");
    assert!(pool.get_token_balance(btc_address) == 0, "Pool BTC balance 0");

    // Conservation check
    assert!(erc20.balance_of(ALICE()) + erc20.balance_of(BOB()) == 5000, "Total conservation");
}

#[test]
fn test_multi_asset_full_flow() {
    let (btc_address, strk_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    let mock_strk = IMockSTRKDispatcher { contract_address: strk_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    // Mint and approve
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(ALICE(), 3000);
    stop_cheat_caller_address(strk_address);

    start_cheat_caller_address(btc_address, ALICE());
    btc_erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, ALICE());
    strk_erc20.approve(pool_address, 3000);
    stop_cheat_caller_address(strk_address);

    let btc_felt: felt252 = btc_address.into();
    let strk_felt: felt252 = strk_address.into();

    // Deposit BTC and STRK
    let c_btc = compute_pool_commitment(1000, btc_felt, 11, 22);
    let c_strk = compute_pool_commitment(500, strk_felt, 33, 44);

    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(btc_address, 1000, c_btc);
    pool.deposit(strk_address, 500, c_strk);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_token_balance(btc_address) == 1000, "BTC balance 1000");
    assert!(pool.get_token_balance(strk_address) == 500, "STRK balance 500");
    assert!(pool.get_commitment_count() == 2, "Count 2");

    // Withdraw BTC to Alice
    let n_btc = compute_nullifier_hash(22);
    let root = pool.get_last_root();
    let proof_btc = build_withdraw_proof(root, n_btc, btc_felt, 1000);
    pool.prepare_withdraw(proof_btc.span(), root, n_btc, btc_address, 1000);
    pool.claim_withdrawal(n_btc, ALICE());

    assert!(btc_erc20.balance_of(ALICE()) == 5000, "Alice BTC back");
    assert!(pool.get_token_balance(btc_address) == 0, "BTC balance 0");

    // Withdraw STRK to Bob
    let n_strk = compute_nullifier_hash(44);
    let root2 = pool.get_last_root();
    let proof_strk = build_withdraw_proof(root2, n_strk, strk_felt, 500);
    pool.prepare_withdraw(proof_strk.span(), root2, n_strk, strk_address, 500);
    pool.claim_withdrawal(n_strk, BOB());

    assert!(strk_erc20.balance_of(BOB()) == 500, "Bob got STRK");
    assert!(pool.get_token_balance(strk_address) == 0, "STRK balance 0");
    assert!(pool.get_commitment_count() == 0, "Count 0");
}

#[test]
fn test_multiple_users_multi_asset() {
    let (btc_address, strk_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    let mock_strk = IMockSTRKDispatcher { contract_address: strk_address };
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };

    // Mint to both users
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(ALICE(), 5000);
    mock_btc.mint(BOB(), 3000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(ALICE(), 5000);
    stop_cheat_caller_address(strk_address);

    // Approvals
    start_cheat_caller_address(btc_address, ALICE());
    btc_erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(btc_address, BOB());
    btc_erc20.approve(pool_address, 3000);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(strk_address, ALICE());
    strk_erc20.approve(pool_address, 5000);
    stop_cheat_caller_address(strk_address);

    let btc_felt: felt252 = btc_address.into();
    let strk_felt: felt252 = strk_address.into();

    // Alice deposits BTC and STRK
    let c1 = compute_pool_commitment(1000, btc_felt, 11, 22);
    let c2 = compute_pool_commitment(500, strk_felt, 33, 44);

    start_cheat_caller_address(pool_address, ALICE());
    pool.deposit(btc_address, 1000, c1);
    pool.deposit(strk_address, 500, c2);
    stop_cheat_caller_address(pool_address);

    // Bob deposits BTC
    let c3 = compute_pool_commitment(500, btc_felt, 55, 66);
    start_cheat_caller_address(pool_address, BOB());
    pool.deposit(btc_address, 500, c3);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 3, "Count 3");
    assert!(pool.get_token_balance(btc_address) == 1500, "BTC balance 1500");
    assert!(pool.get_token_balance(strk_address) == 500, "STRK balance 500");

    // Everyone withdraws
    let n1 = compute_nullifier_hash(22);
    let n2 = compute_nullifier_hash(44);
    let n3 = compute_nullifier_hash(66);

    let root = pool.get_last_root();

    let p1 = build_withdraw_proof(root, n1, btc_felt, 1000);
    pool.prepare_withdraw(p1.span(), root, n1, btc_address, 1000);
    pool.claim_withdrawal(n1, ALICE());

    let p2 = build_withdraw_proof(root, n2, strk_felt, 500);
    pool.prepare_withdraw(p2.span(), root, n2, strk_address, 500);
    pool.claim_withdrawal(n2, ALICE());

    let p3 = build_withdraw_proof(root, n3, btc_felt, 500);
    pool.prepare_withdraw(p3.span(), root, n3, btc_address, 500);
    pool.claim_withdrawal(n3, BOB());

    assert!(btc_erc20.balance_of(ALICE()) == 5000, "Alice BTC 5000");
    assert!(strk_erc20.balance_of(ALICE()) == 5000, "Alice STRK 5000");
    assert!(btc_erc20.balance_of(BOB()) == 3000, "Bob BTC 3000");
    assert!(pool.get_commitment_count() == 0, "Count 0");
    assert!(pool.get_token_balance(btc_address) == 0, "BTC balance 0");
    assert!(pool.get_token_balance(strk_address) == 0, "STRK balance 0");
}
