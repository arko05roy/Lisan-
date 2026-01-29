use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};
use lisan_contracts::shielded_pool::{IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait};
use lisan_contracts::commitment::compute_commitment;

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
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

    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(USER1(), 10000);
    stop_cheat_caller_address(btc_address);

    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, USER1());
    erc20.approve(pool_address, 10000);
    stop_cheat_caller_address(btc_address);

    (btc_address, pool_address)
}

#[test]
fn test_basic_deposit() {
    let (btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let commitment = compute_commitment(1000, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(1000, commitment);
    stop_cheat_caller_address(pool_address);

    assert!(pool.is_commitment_valid(commitment), "Commitment should be valid");
    assert!(pool.get_commitment_count() == 1, "Count should be 1");
    assert!(pool.get_total_deposited() == 1000, "Total should be 1000");
    assert!(erc20.balance_of(USER1()) == 9000, "User balance wrong");
    assert!(erc20.balance_of(pool_address) == 1000, "Pool balance wrong");
}

#[test]
#[should_panic(expected: 'Amount must be > 0')]
fn test_zero_amount_fails() {
    let (_, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(0, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(0, commitment);
    stop_cheat_caller_address(pool_address);
}

#[test]
#[should_panic(expected: 'Commitment already exists')]
fn test_duplicate_commitment_fails() {
    let (_, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(500, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(500, commitment);
    pool.deposit(500, commitment);
    stop_cheat_caller_address(pool_address);
}

#[test]
fn test_multiple_deposits() {
    let (_, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let c1 = compute_commitment(500, 1, 1);
    let c2 = compute_commitment(300, 2, 2);
    let c3 = compute_commitment(200, 3, 3);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(500, c1);
    pool.deposit(300, c2);
    pool.deposit(200, c3);
    stop_cheat_caller_address(pool_address);

    assert!(pool.get_commitment_count() == 3, "Count should be 3");
    assert!(pool.get_total_deposited() == 1000, "Total should be 1000");
    assert!(pool.is_commitment_valid(c1), "c1 should be valid");
    assert!(pool.is_commitment_valid(c2), "c2 should be valid");
    assert!(pool.is_commitment_valid(c3), "c3 should be valid");
}

#[test]
#[should_panic]
fn test_insufficient_balance_fails() {
    let (_btc_address, pool_address) = setup();
    let pool = IShieldedPoolDispatcher { contract_address: pool_address };

    let commitment = compute_commitment(99999, 42, 99);

    start_cheat_caller_address(pool_address, USER1());
    pool.deposit(99999, commitment);
    stop_cheat_caller_address(pool_address);
}
