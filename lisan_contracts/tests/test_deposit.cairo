use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::mock_strk::{IMockSTRKDispatcher, IMockSTRKDispatcherTrait};
use lisan_contracts::shielded_pool::{IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait};
use lisan_contracts::commitment::compute_pool_commitment;

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

/// Deploy MockBTC, MockSTRK, MockGroth16Verifiers (withdraw=4 inputs, transfer=4 inputs),
/// and ShieldedPool. Mint tokens to USER1 and approve pool.
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

    // Withdraw verifier: 4 public inputs (root, nullifier, tokenAddress, amount)
    let mut wv_calldata = array![4];
    let (withdraw_verifier, _) = verifier_class.deploy(@wv_calldata).unwrap();

    // Transfer verifier: 4 public inputs (root, nullifier, senderComm, recipientComm)
    let mut tv_calldata = array![4];
    let (transfer_verifier, _) = verifier_class.deploy(@tv_calldata).unwrap();

    // Deploy ShieldedPool (no btc_token param — token-agnostic)
    let pool_class = declare("ShieldedPool").unwrap().contract_class();
    let mut pool_calldata = array![];
    withdraw_verifier.serialize(ref pool_calldata);
    transfer_verifier.serialize(ref pool_calldata);
    let (pool_address, _) = pool_class.deploy(@pool_calldata).unwrap();

    // Mint tokens to USER1
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let mock_strk = IMockSTRKDispatcher { contract_address: strk_address };
    start_cheat_caller_address(strk_address, OWNER());
    mock_strk.mint(USER1(), 10000);
    stop_cheat_caller_address(strk_address);

    // USER1 approves pool for both tokens
    let btc_erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    btc_erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    let strk_erc20 = IERC20Dispatcher { contract_address: strk_address };
    start_cheat_caller_address(strk_address, USER1());
    strk_erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(strk_address);

    (btc_address, strk_address, pool_address)
}

#[test]
fn test_basic_deposit_btc() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let token_felt: felt252 = btc_address.into();
    let commitment = compute_pool_commitment(1000, token_felt, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 1000, commitment);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_token_balance(btc_address) == 1000, "BTC balance should be 1000");
    assert!(erc20.balance_of(USER1()) == 9000, "User balance wrong");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool balance wrong");
}

#[test]
fn test_basic_deposit_strk() {
    let (_, strk_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: strk_address };

    let token_felt: felt252 = strk_address.into();
    let commitment = compute_pool_commitment(500, token_felt, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(strk_address, 500, commitment);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_token_balance(strk_address) == 500, "STRK balance should be 500");
    assert!(erc20.balance_of(USER1()) == 9500, "User balance wrong");
}

#[test]
fn test_multi_asset_deposit() {
    let (btc_address, strk_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let btc_felt: felt252 = btc_address.into();
    let strk_felt: felt252 = strk_address.into();

    let c1 = compute_pool_commitment(1000, btc_felt, 1, 2);
    let c2 = compute_pool_commitment(500, strk_felt, 3, 4);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 1000, c1);
    pool.deposit(strk_address, 500, c2);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 2, "Count should be 2");
    assert!(pool.get_token_balance(btc_address) == 1000, "BTC balance should be 1000");
    assert!(pool.get_token_balance(strk_address) == 500, "STRK balance should be 500");
}

#[test]
#[should_panic(expected: 'Amount must be > 0')]
fn test_zero_amount_fails() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let token_felt: felt252 = btc_address.into();
    let commitment = compute_pool_commitment(0, token_felt, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 0, commitment);
    stop_cheat_caller_address(pool_address);
}

#[test]
fn test_multiple_deposits_same_token() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let token_felt: felt252 = btc_address.into();
    let c1 = compute_pool_commitment(500, token_felt, 1, 1);
    let c2 = compute_pool_commitment(300, token_felt, 2, 2);
    let c3 = compute_pool_commitment(200, token_felt, 3, 3);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 500, c1);
    pool.deposit(btc_address, 300, c2);
    pool.deposit(btc_address, 200, c3);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 3, "Count should be 3");
    assert!(pool.get_token_balance(btc_address) == 1000, "BTC balance should be 1000");
}

#[test]
#[should_panic]
fn test_insufficient_balance_fails() {
    let (btc_address, _, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let token_felt: felt252 = btc_address.into();
    let commitment = compute_pool_commitment(99999, token_felt, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(btc_address, 99999, commitment);
    stop_cheat_caller_address(pool_address);
}
