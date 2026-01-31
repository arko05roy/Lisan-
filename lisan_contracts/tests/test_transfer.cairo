use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::shielded_pool::{IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait};
use lisan_contracts::commitment::{compute_pool_commitment, compute_nullifier_hash};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

/// Build mock proof for pool transfer.
/// MockGroth16Verifier reads: [root, nullifier, senderComm, recipientComm]
fn build_transfer_proof(
    root: felt252,
    nullifier_hash: felt252,
    new_commitment_sender: felt252,
    new_commitment_recipient: felt252,
) -> Array<felt252> {
    array![root, nullifier_hash, new_commitment_sender, new_commitment_recipient]
}

fn setup_with_deposit() -> (ContractAddress, ContractAddress) {
    let btc_class = declare("MockBTC").unwrap().contract_class();
    let mut btc_calldata = array![];
    OWNER().serialize(ref btc_calldata);
    let (btc_address, _) = btc_class.deploy(@btc_calldata).unwrap();

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

    (btc_address, pool_address)
}

#[test]
fn test_valid_transfer() {
    let (btc_address, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let token_felt: felt252 = btc_address.into();
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment_sender = compute_pool_commitment(700, token_felt, 100, 200);
    let new_commitment_recipient = compute_pool_commitment(300, token_felt, 101, 201);

    let root = pool.get_last_root();
    let proof = build_transfer_proof(root, nullifier_hash, new_commitment_sender, new_commitment_recipient);

    pool.transfer(proof.span(), root, nullifier_hash, new_commitment_sender, new_commitment_recipient);

    assert!(pool.is_nullifier_used(nullifier_hash), "Nullifier should be used");
    // +2 new commitments, -1 spent (but still in tree) = net +1
    assert!(pool.get_commitment_count() == 2, "Count should be 2");
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_double_spend_prevention() {
    let (btc_address, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let token_felt: felt252 = btc_address.into();
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment_sender = compute_pool_commitment(700, token_felt, 100, 200);
    let new_commitment_recipient = compute_pool_commitment(300, token_felt, 101, 201);

    let root = pool.get_last_root();
    let proof = build_transfer_proof(root, nullifier_hash, new_commitment_sender, new_commitment_recipient);

    pool.transfer(proof.span(), root, nullifier_hash, new_commitment_sender, new_commitment_recipient);

    // Second transfer with same nullifier should fail
    let fake_sender = compute_pool_commitment(700, token_felt, 300, 400);
    let fake_recipient = compute_pool_commitment(300, token_felt, 301, 401);
    let root2 = pool.get_last_root();
    let proof2 = build_transfer_proof(root2, nullifier_hash, fake_sender, fake_recipient);

    pool.transfer(proof2.span(), root2, nullifier_hash, fake_sender, fake_recipient);
}

#[test]
#[should_panic(expected: 'Unknown Merkle root')]
fn test_wrong_root_fails() {
    let (btc_address, pool_address) = setup_with_deposit();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let token_felt: felt252 = btc_address.into();
    let nullifier_hash = compute_nullifier_hash(99);
    let new_commitment_sender = compute_pool_commitment(700, token_felt, 100, 200);
    let new_commitment_recipient = compute_pool_commitment(300, token_felt, 101, 201);

    let fake_root: felt252 = 999999;
    let proof = build_transfer_proof(fake_root, nullifier_hash, new_commitment_sender, new_commitment_recipient);

    pool.transfer(proof.span(), fake_root, nullifier_hash, new_commitment_sender, new_commitment_recipient);
}
