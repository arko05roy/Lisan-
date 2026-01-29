use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{
    IERC20Dispatcher, IERC20DispatcherTrait, IERC20MetadataDispatcher,
    IERC20MetadataDispatcherTrait,
};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn USER2() -> ContractAddress {
    0x3.try_into().unwrap()
}

fn deploy_mock_btc() -> ContractAddress {
    let contract = declare("MockBTC").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

#[test]
fn test_constructor() {
    let address = deploy_mock_btc();
    let metadata = IERC20MetadataDispatcher { contract_address: address };
    let erc20 = IERC20Dispatcher { contract_address: address };
    assert!(metadata.name() == "MockBTC", "Wrong name");
    assert!(metadata.symbol() == "mBTC", "Wrong symbol");
    assert!(erc20.total_supply() == 0, "Supply should be 0");
}

#[test]
fn test_mint() {
    let address = deploy_mock_btc();
    let erc20 = IERC20Dispatcher { contract_address: address };
    let mock_btc = IMockBTCDispatcher { contract_address: address };

    start_cheat_caller_address(address, OWNER());
    mock_btc.mint(USER1(), 1000);
    stop_cheat_caller_address(address);

    assert!(erc20.balance_of(USER1()) == 1000, "Balance should be 1000");
    assert!(erc20.total_supply() == 1000, "Supply should be 1000");
}

#[test]
fn test_transfer() {
    let address = deploy_mock_btc();
    let erc20 = IERC20Dispatcher { contract_address: address };
    let mock_btc = IMockBTCDispatcher { contract_address: address };

    start_cheat_caller_address(address, OWNER());
    mock_btc.mint(USER1(), 1000);
    stop_cheat_caller_address(address);

    start_cheat_caller_address(address, USER1());
    erc20.transfer(USER2(), 300);
    stop_cheat_caller_address(address);

    assert!(erc20.balance_of(USER1()) == 700, "Sender balance wrong");
    assert!(erc20.balance_of(USER2()) == 300, "Receiver balance wrong");
}

#[test]
fn test_approve_and_transfer_from() {
    let address = deploy_mock_btc();
    let erc20 = IERC20Dispatcher { contract_address: address };
    let mock_btc = IMockBTCDispatcher { contract_address: address };

    start_cheat_caller_address(address, OWNER());
    mock_btc.mint(USER1(), 1000);
    stop_cheat_caller_address(address);

    start_cheat_caller_address(address, USER1());
    erc20.approve(USER2(), 500);
    stop_cheat_caller_address(address);

    start_cheat_caller_address(address, USER2());
    erc20.transfer_from(USER1(), USER2(), 300);
    stop_cheat_caller_address(address);

    assert!(erc20.balance_of(USER1()) == 700, "Sender balance wrong");
    assert!(erc20.balance_of(USER2()) == 300, "Receiver balance wrong");
    assert!(erc20.allowance(USER1(), USER2()) == 200, "Allowance wrong");
}

#[test]
#[should_panic]
fn test_mint_not_owner() {
    let address = deploy_mock_btc();
    let mock_btc = IMockBTCDispatcher { contract_address: address };

    start_cheat_caller_address(address, USER1());
    mock_btc.mint(USER1(), 1000);
    stop_cheat_caller_address(address);
}
