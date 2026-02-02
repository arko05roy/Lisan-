use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::relayer_registry::{
    IRelayerRegistryDispatcher, IRelayerRegistryDispatcherTrait,
};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn COORDINATOR() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn RELAYER1() -> ContractAddress {
    0x3.try_into().unwrap()
}

fn RELAYER2() -> ContractAddress {
    0x4.try_into().unwrap()
}

fn RELAYER3() -> ContractAddress {
    0x5.try_into().unwrap()
}

fn deploy_mock_btc() -> ContractAddress {
    let contract = declare("MockBTC").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn deploy_registry(stake_token: ContractAddress, min_stake: u256) -> ContractAddress {
    let contract = declare("RelayerRegistry").unwrap().contract_class();
    let mut calldata = array![];
    stake_token.serialize(ref calldata);
    min_stake.serialize(ref calldata);

    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn get_deployer() -> ContractAddress {
    // The deployer in tests is 0x0
    0x0.try_into().unwrap()
}

fn setup() -> (ContractAddress, ContractAddress) {
    let btc_address = deploy_mock_btc();
    let min_stake = 1000000000000000000; // 1 BTC
    let registry_address = deploy_registry(btc_address, min_stake);

    // Mint BTC to relayers
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(RELAYER1(), 10000000000000000000); // 10 BTC
    mock_btc.mint(RELAYER2(), 10000000000000000000); // 10 BTC
    mock_btc.mint(RELAYER3(), 10000000000000000000); // 10 BTC
    stop_cheat_caller_address(btc_address);

    (btc_address, registry_address)
}

#[test]
fn test_register_relayer_success() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Approve registry to spend BTC
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    // Register relayer
    start_cheat_caller_address(registry_address, RELAYER1());
    start_cheat_block_timestamp(registry_address, 1000);
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_block_timestamp(registry_address);
    stop_cheat_caller_address(registry_address);

    // Verify relayer registered
    assert!(relayer_id == 1, "Relayer ID should be 1");
    assert!(registry.get_relayer_count() == 1, "Relayer count should be 1");
    assert!(registry.get_active_relayer_count() == 1, "Active count should be 1");
    assert!(registry.is_relayer_active(relayer_id), "Relayer should be active");

    // Check relayer info
    let info = registry.get_relayer_info(relayer_id);
    assert!(info.address == RELAYER1(), "Wrong address");
    assert!(info.stake == stake_amount, "Wrong stake");
    assert!(info.active == true, "Should be active");
    assert!(info.total_submissions == 0, "Should have 0 submissions");
    assert!(info.failed_submissions == 0, "Should have 0 failures");
    assert!(info.total_earnings == 0, "Should have 0 earnings");
    assert!(info.registration_time == 1000, "Wrong registration time");

    // Check BTC transferred
    assert!(erc20.balance_of(RELAYER1()) == 9000000000000000000, "Relayer balance wrong");
    assert!(erc20.balance_of(registry_address) == stake_amount, "Registry balance wrong");
}

#[test]
#[should_panic(expected: ('Insufficient stake',))]
fn test_register_relayer_insufficient_stake() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 500000000000000000; // 0.5 BTC (below minimum)

    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);
}

#[test]
#[should_panic(expected: ('Already registered',))]
fn test_register_relayer_already_registered() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // First registration
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount * 2);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    registry.register_relayer(stake_amount);

    // Try to register again
    registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);
}

#[test]
fn test_unregister_relayer() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Register
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id = registry.register_relayer(stake_amount);

    // Unregister
    registry.unregister_relayer(relayer_id);
    stop_cheat_caller_address(registry_address);

    // Verify
    assert!(!registry.is_relayer_active(relayer_id), "Should be inactive");
    assert!(registry.get_active_relayer_count() == 0, "Active count should be 0");
    assert!(erc20.balance_of(RELAYER1()) == 10000000000000000000, "Stake should be returned");
    assert!(erc20.balance_of(registry_address) == 0, "Registry should be empty");
}

#[test]
fn test_check_owner() {
    let (_btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };

    let owner = registry.get_owner();
    // Debug: let's see what the owner actually is
    assert!(owner != get_deployer(), "Testing: owner is not deployer");
}

#[test]
fn test_set_coordinator() {
    let (_btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };

    let owner = registry.get_owner();
    // Set coordinator as the actual owner from the contract
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);
}

#[test]
#[should_panic(expected: ('Only owner',))]
fn test_set_coordinator_not_owner() {
    let (_btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };

    // Try to set coordinator as non-owner
    start_cheat_caller_address(registry_address, RELAYER1());
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);
}

#[test]
fn test_record_submission() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Register relayer
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Set coordinator using actual owner from contract
    let owner = registry.get_owner();
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);

    // Record successful submission
    start_cheat_caller_address(registry_address, COORDINATOR());
    registry.record_submission(relayer_id, true);
    stop_cheat_caller_address(registry_address);

    let info = registry.get_relayer_info(relayer_id);
    assert!(info.total_submissions == 1, "Should have 1 submission");
    assert!(info.failed_submissions == 0, "Should have 0 failures");

    // Record failed submission
    start_cheat_caller_address(registry_address, COORDINATOR());
    registry.record_submission(relayer_id, false);
    stop_cheat_caller_address(registry_address);

    let info = registry.get_relayer_info(relayer_id);
    assert!(info.total_submissions == 2, "Should have 2 submissions");
    assert!(info.failed_submissions == 1, "Should have 1 failure");
}

#[test]
fn test_add_earnings() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Register relayer
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Set coordinator using actual owner from contract
    let owner = registry.get_owner();
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);

    // Add earnings
    let earnings = 5000000000000000; // 0.005 BTC
    start_cheat_caller_address(registry_address, COORDINATOR());
    registry.add_earnings(relayer_id, earnings);
    stop_cheat_caller_address(registry_address);

    let info = registry.get_relayer_info(relayer_id);
    assert!(info.total_earnings == earnings, "Wrong earnings");
}

#[test]
fn test_claim_earnings() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Register relayer
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Set coordinator and add earnings
    let owner = registry.get_owner();
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);

    let earnings = 5000000000000000; // 0.005 BTC

    // Mint earnings to registry
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(registry_address, earnings);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, COORDINATOR());
    registry.add_earnings(relayer_id, earnings);
    stop_cheat_caller_address(registry_address);

    // Claim earnings
    let balance_before = erc20.balance_of(RELAYER1());
    start_cheat_caller_address(registry_address, RELAYER1());
    registry.claim_earnings();
    stop_cheat_caller_address(registry_address);

    let balance_after = erc20.balance_of(RELAYER1());
    assert!(balance_after == balance_before + earnings, "Earnings not transferred");

    // Check earnings reset to 0
    let info = registry.get_relayer_info(relayer_id);
    assert!(info.total_earnings == 0, "Earnings should be 0 after claim");
}

#[test]
fn test_slash_relayer_10_percent() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 2000000000000000000; // 2 BTC (so after 10% slash still above min)

    // Register relayer
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Set coordinator using actual owner from contract
    let owner = registry.get_owner();
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);

    // Slash 10%
    start_cheat_caller_address(registry_address, COORDINATOR());
    registry.slash_relayer(relayer_id, 1000); // 10% = 1000 bps
    stop_cheat_caller_address(registry_address);

    let info = registry.get_relayer_info(relayer_id);
    let expected_stake = 1800000000000000000; // 1.8 BTC
    assert!(info.stake == expected_stake, "Stake not slashed correctly");
    assert!(info.active == true, "Should still be active (above min stake)");
}

#[test]
fn test_slash_relayer_deactivation() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Register relayer
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Set coordinator using actual owner from contract
    let owner = registry.get_owner();
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(COORDINATOR());
    stop_cheat_caller_address(registry_address);

    // Slash 30% (stake goes below minimum of 1 BTC)
    start_cheat_caller_address(registry_address, COORDINATOR());
    registry.slash_relayer(relayer_id, 3000); // 30% = 3000 bps
    stop_cheat_caller_address(registry_address);

    let info = registry.get_relayer_info(relayer_id);
    let expected_stake = 700000000000000000; // 0.7 BTC
    assert!(info.stake == expected_stake, "Stake not slashed correctly");
    assert!(info.active == false, "Should be deactivated");
    assert!(registry.get_active_relayer_count() == 0, "Active count should be 0");
}

#[test]
fn test_multiple_relayers() {
    let (btc_address, registry_address) = setup();
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };

    let stake_amount = 1000000000000000000; // 1 BTC

    // Register relayer 1
    start_cheat_caller_address(btc_address, RELAYER1());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER1());
    let relayer_id1 = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Register relayer 2
    start_cheat_caller_address(btc_address, RELAYER2());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER2());
    let relayer_id2 = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Register relayer 3
    start_cheat_caller_address(btc_address, RELAYER3());
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, RELAYER3());
    let relayer_id3 = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    // Verify all registered
    assert!(relayer_id1 == 1, "Relayer 1 ID wrong");
    assert!(relayer_id2 == 2, "Relayer 2 ID wrong");
    assert!(relayer_id3 == 3, "Relayer 3 ID wrong");
    assert!(registry.get_relayer_count() == 3, "Should have 3 relayers");
    assert!(registry.get_active_relayer_count() == 3, "Should have 3 active relayers");

    // Verify all active
    assert!(registry.is_relayer_active(relayer_id1), "Relayer 1 should be active");
    assert!(registry.is_relayer_active(relayer_id2), "Relayer 2 should be active");
    assert!(registry.is_relayer_active(relayer_id3), "Relayer 3 should be active");
}
