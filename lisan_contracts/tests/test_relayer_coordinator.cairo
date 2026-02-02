use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use lisan_contracts::relayer_coordinator::{
    IRelayerCoordinatorDispatcher, IRelayerCoordinatorDispatcherTrait,
};
use lisan_contracts::relayer_registry::{IRelayerRegistryDispatcher, IRelayerRegistryDispatcherTrait};
use lisan_contracts::mock_btc::{IMockBTCDispatcher, IMockBTCDispatcherTrait};

fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
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

fn deploy_coordinator(
    registry: ContractAddress,
    pool: ContractAddress,
    fee_bps: u256,
    slash_penalty_bps: u256,
    max_failures: u256,
) -> ContractAddress {
    let contract = declare("RelayerCoordinator").unwrap().contract_class();
    let mut calldata = array![];
    registry.serialize(ref calldata);
    pool.serialize(ref calldata);
    fee_bps.serialize(ref calldata);
    slash_penalty_bps.serialize(ref calldata);
    max_failures.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn setup() -> (ContractAddress, ContractAddress, ContractAddress) {
    let btc_address = deploy_mock_btc();
    let min_stake = 1000000000000000000; // 1 BTC
    let registry_address = deploy_registry(btc_address, min_stake);

    // Deploy coordinator with dummy pool address (we'll test without actual pool)
    let dummy_pool = 0x999.try_into().unwrap();
    let coordinator_address = deploy_coordinator(
        registry_address, dummy_pool, 10, 1000, 3, // 0.1% fee, 10% slash, 3 max failures
    );

    // Set coordinator in registry using actual owner
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let owner = registry.get_owner();
    start_cheat_caller_address(registry_address, owner);
    registry.set_coordinator(coordinator_address);
    stop_cheat_caller_address(registry_address);

    // Mint BTC to relayers
    let mock_btc = IMockBTCDispatcher { contract_address: btc_address };
    start_cheat_caller_address(btc_address, OWNER());
    mock_btc.mint(RELAYER1(), 10000000000000000000); // 10 BTC
    mock_btc.mint(RELAYER2(), 10000000000000000000); // 10 BTC
    mock_btc.mint(RELAYER3(), 10000000000000000000); // 10 BTC
    stop_cheat_caller_address(btc_address);

    (btc_address, registry_address, coordinator_address)
}

fn register_relayer(
    registry_address: ContractAddress, btc_address: ContractAddress, relayer: ContractAddress,
) -> u256 {
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };
    let erc20 = IERC20Dispatcher { contract_address: btc_address };
    let stake_amount = 1000000000000000000; // 1 BTC

    start_cheat_caller_address(btc_address, relayer);
    erc20.approve(registry_address, stake_amount);
    stop_cheat_caller_address(btc_address);

    start_cheat_caller_address(registry_address, relayer);
    let relayer_id = registry.register_relayer(stake_amount);
    stop_cheat_caller_address(registry_address);

    relayer_id
}

#[test]
fn test_get_estimated_fee() {
    let (_btc_address, _registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    let tx_amount = 5000000000000000000; // 5 BTC
    let fee = coordinator.get_estimated_fee(tx_amount);

    // 0.1% of 5 BTC = 0.005 BTC
    let expected_fee = 5000000000000000; // 0.005 BTC
    assert!(fee == expected_fee, "Fee calculation wrong");
}

#[test]
fn test_select_relayer_round_robin() {
    let (btc_address, registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    // Register 3 relayers
    register_relayer(registry_address, btc_address, RELAYER1());
    register_relayer(registry_address, btc_address, RELAYER2());
    register_relayer(registry_address, btc_address, RELAYER3());

    // Select relayers in round-robin order (anyone can call select_relayer)
    let relayer1 = coordinator.select_relayer();
    let relayer2 = coordinator.select_relayer();
    let relayer3 = coordinator.select_relayer();
    let relayer4 = coordinator.select_relayer(); // Should wrap back to 1

    assert!(relayer1 == 1, "First selection should be relayer 1");
    assert!(relayer2 == 2, "Second selection should be relayer 2");
    assert!(relayer3 == 3, "Third selection should be relayer 3");
    assert!(relayer4 == 1, "Fourth selection should wrap to relayer 1");
}

#[test]
fn test_select_relayer_skip_inactive() {
    let (btc_address, registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };
    let registry = IRelayerRegistryDispatcher { contract_address: registry_address };

    // Register 3 relayers
    let relayer1_id = register_relayer(registry_address, btc_address, RELAYER1());
    register_relayer(registry_address, btc_address, RELAYER2());
    register_relayer(registry_address, btc_address, RELAYER3());

    // Unregister relayer 1 (make it inactive)
    start_cheat_caller_address(registry_address, RELAYER1());
    registry.unregister_relayer(relayer1_id);
    stop_cheat_caller_address(registry_address);

    // Select relayers - should skip relayer 1
    let relayer_a = coordinator.select_relayer();
    let relayer_b = coordinator.select_relayer();
    let relayer_c = coordinator.select_relayer();

    // Should only get relayer 2 and 3, cycling between them
    assert!(relayer_a == 2, "Should skip inactive relayer 1");
    assert!(relayer_b == 3, "Should select relayer 3");
    assert!(relayer_c == 2, "Should cycle back to relayer 2");
}

#[test]
#[should_panic(expected: ('No active relayers',))]
fn test_select_relayer_no_active() {
    let (_btc_address, _registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    // Try to select relayer when none are registered
    coordinator.select_relayer();
}

#[test]
fn test_set_fee_bps() {
    let (_btc_address, _registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    // Initial fee should be 10 (0.1%)
    assert!(coordinator.get_fee_bps() == 10, "Initial fee wrong");

    // Update fee using actual owner
    let owner = coordinator.get_owner();
    start_cheat_caller_address(coordinator_address, owner);
    coordinator.set_fee_bps(20); // 0.2%
    stop_cheat_caller_address(coordinator_address);

    assert!(coordinator.get_fee_bps() == 20, "Updated fee wrong");
}

#[test]
#[should_panic(expected: ('Only owner',))]
fn test_set_fee_bps_not_owner() {
    let (_btc_address, _registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    start_cheat_caller_address(coordinator_address, RELAYER1());
    coordinator.set_fee_bps(20);
    stop_cheat_caller_address(coordinator_address);
}

#[test]
fn test_get_config_values() {
    let (_btc_address, _registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    assert!(coordinator.get_fee_bps() == 10, "Fee BPS wrong");
    assert!(coordinator.get_slash_penalty_bps() == 1000, "Slash penalty wrong");
    assert!(coordinator.get_max_failures() == 3, "Max failures wrong");
}

#[test]
fn test_fee_calculation_examples() {
    let (_btc_address, _registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    // Test various amounts
    let amounts = array![
        1000000000000000000, // 1 BTC
        5000000000000000000, // 5 BTC
        10000000000000000000, // 10 BTC
        100000000000000000, // 0.1 BTC
    ];

    let expected_fees = array![
        1000000000000000, // 0.001 BTC (0.1% of 1)
        5000000000000000, // 0.005 BTC (0.1% of 5)
        10000000000000000, // 0.01 BTC (0.1% of 10)
        100000000000000, // 0.0001 BTC (0.1% of 0.1)
    ];

    let mut i = 0;
    loop {
        if i >= amounts.len() {
            break;
        }

        let amount = *amounts.at(i);
        let expected_fee = *expected_fees.at(i);
        let actual_fee = coordinator.get_estimated_fee(amount);

        assert!(actual_fee == expected_fee, "Fee calculation wrong");

        i += 1;
    }
}

#[test]
fn test_multiple_relayers_selection_fairness() {
    let (btc_address, registry_address, coordinator_address) = setup();
    let coordinator = IRelayerCoordinatorDispatcher { contract_address: coordinator_address };

    // Register 3 relayers
    register_relayer(registry_address, btc_address, RELAYER1());
    register_relayer(registry_address, btc_address, RELAYER2());
    register_relayer(registry_address, btc_address, RELAYER3());

    // Select 9 times and count selections
    let mut selections: Array<u256> = array![];

    let mut i: u32 = 0;
    loop {
        if i >= 9_u32 {
            break;
        }
        let selected = coordinator.select_relayer();
        selections.append(selected);
        i += 1;
    }

    // Should cycle through 1, 2, 3, 1, 2, 3, 1, 2, 3
    assert!(*selections.at(0) == 1, "Selection 0 wrong");
    assert!(*selections.at(1) == 2, "Selection 1 wrong");
    assert!(*selections.at(2) == 3, "Selection 2 wrong");
    assert!(*selections.at(3) == 1, "Selection 3 wrong");
    assert!(*selections.at(4) == 2, "Selection 4 wrong");
    assert!(*selections.at(5) == 3, "Selection 5 wrong");
    assert!(*selections.at(6) == 1, "Selection 6 wrong");
    assert!(*selections.at(7) == 2, "Selection 7 wrong");
    assert!(*selections.at(8) == 3, "Selection 8 wrong");
}
