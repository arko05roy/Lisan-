use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct RelayerInfo {
    pub address: ContractAddress,
    pub stake: u256,
    pub active: bool,
    pub total_submissions: u256,
    pub failed_submissions: u256,
    pub total_earnings: u256,
    pub registration_time: u64,
}

#[starknet::interface]
pub trait IRelayerRegistry<TContractState> {
    fn register_relayer(ref self: TContractState, stake_amount: u256) -> u256;
    fn unregister_relayer(ref self: TContractState, relayer_id: u256);
    fn get_relayer_info(self: @TContractState, relayer_id: u256) -> RelayerInfo;
    fn is_relayer_active(self: @TContractState, relayer_id: u256) -> bool;
    fn get_relayer_count(self: @TContractState) -> u256;
    fn get_active_relayer_count(self: @TContractState) -> u256;
    fn record_submission(ref self: TContractState, relayer_id: u256, success: bool);
    fn add_earnings(ref self: TContractState, relayer_id: u256, amount: u256);
    fn slash_relayer(ref self: TContractState, relayer_id: u256, penalty_bps: u256);
    fn claim_earnings(ref self: TContractState);
    fn set_coordinator(ref self: TContractState, coordinator: ContractAddress);
    fn get_min_stake(self: @TContractState) -> u256;
    fn get_owner(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod RelayerRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::RelayerInfo;

    #[storage]
    struct Storage {
        relayers: Map<u256, RelayerInfo>,
        relayer_count: u256,
        address_to_id: Map<ContractAddress, u256>,
        active_relayer_count: u256,
        stake_token: ContractAddress,
        min_stake: u256,
        coordinator: ContractAddress,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RelayerRegistered: RelayerRegistered,
        RelayerUnregistered: RelayerUnregistered,
        RelayerSlashed: RelayerSlashed,
        EarningsClaimed: EarningsClaimed,
        CoordinatorSet: CoordinatorSet,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RelayerRegistered {
        #[key]
        pub relayer_id: u256,
        #[key]
        pub address: ContractAddress,
        pub stake: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RelayerUnregistered {
        #[key]
        pub relayer_id: u256,
        #[key]
        pub address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RelayerSlashed {
        #[key]
        pub relayer_id: u256,
        pub penalty: u256,
        pub new_stake: u256,
        pub deactivated: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EarningsClaimed {
        #[key]
        pub relayer_id: u256,
        #[key]
        pub address: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoordinatorSet {
        pub coordinator: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, stake_token: ContractAddress, min_stake: u256, owner: ContractAddress,
    ) {
        self.stake_token.write(stake_token);
        self.min_stake.write(min_stake);
        self.owner.write(owner);
        self.relayer_count.write(0);
        self.active_relayer_count.write(0);
    }

    #[abi(embed_v0)]
    impl RelayerRegistryImpl of super::IRelayerRegistry<ContractState> {
        fn register_relayer(ref self: ContractState, stake_amount: u256) -> u256 {
            let caller = get_caller_address();

            // Check caller not already registered
            assert(self.address_to_id.read(caller) == 0, 'Already registered');

            // Check stake meets minimum requirement
            let min_stake = self.min_stake.read();
            assert(stake_amount >= min_stake, 'Insufficient stake');

            // Transfer stake token from caller to contract
            let token = IERC20Dispatcher { contract_address: self.stake_token.read() };
            let success = token
                .transfer_from(caller, starknet::get_contract_address(), stake_amount);
            assert(success, 'Stake transfer failed');

            // Increment relayer_count and create new relayer ID
            let new_count = self.relayer_count.read() + 1;
            self.relayer_count.write(new_count);

            // Create RelayerInfo entry
            let relayer_info = RelayerInfo {
                address: caller,
                stake: stake_amount,
                active: true,
                total_submissions: 0,
                failed_submissions: 0,
                total_earnings: 0,
                registration_time: get_block_timestamp(),
            };

            self.relayers.write(new_count, relayer_info);
            self.address_to_id.write(caller, new_count);
            self.active_relayer_count.write(self.active_relayer_count.read() + 1);

            self
                .emit(
                    RelayerRegistered {
                        relayer_id: new_count,
                        address: caller,
                        stake: stake_amount,
                        timestamp: get_block_timestamp(),
                    },
                );

            new_count
        }

        fn unregister_relayer(ref self: ContractState, relayer_id: u256) {
            let caller = get_caller_address();

            // Check relayer exists and caller owns it
            let relayer_info = self.relayers.read(relayer_id);
            assert(relayer_info.address == caller, 'Not relayer owner');

            // Return stake if active
            if relayer_info.active {
                let token = IERC20Dispatcher { contract_address: self.stake_token.read() };
                let success = token.transfer(caller, relayer_info.stake);
                assert(success, 'Stake return failed');

                // Decrement active count
                self.active_relayer_count.write(self.active_relayer_count.read() - 1);
            }

            // Mark relayer as inactive
            let updated_info = RelayerInfo {
                address: relayer_info.address,
                stake: 0,
                active: false,
                total_submissions: relayer_info.total_submissions,
                failed_submissions: relayer_info.failed_submissions,
                total_earnings: relayer_info.total_earnings,
                registration_time: relayer_info.registration_time,
            };
            self.relayers.write(relayer_id, updated_info);

            // Remove address mapping
            self.address_to_id.write(caller, 0);

            self.emit(RelayerUnregistered { relayer_id, address: caller });
        }

        fn get_relayer_info(self: @ContractState, relayer_id: u256) -> RelayerInfo {
            self.relayers.read(relayer_id)
        }

        fn is_relayer_active(self: @ContractState, relayer_id: u256) -> bool {
            let relayer_info = self.relayers.read(relayer_id);
            relayer_info.active
        }

        fn get_relayer_count(self: @ContractState) -> u256 {
            self.relayer_count.read()
        }

        fn get_active_relayer_count(self: @ContractState) -> u256 {
            self.active_relayer_count.read()
        }

        fn record_submission(ref self: ContractState, relayer_id: u256, success: bool) {
            // Only coordinator can call this
            let caller = get_caller_address();
            assert(caller == self.coordinator.read(), 'Only coordinator');

            let mut relayer_info = self.relayers.read(relayer_id);

            relayer_info.total_submissions = relayer_info.total_submissions + 1;

            if !success {
                relayer_info.failed_submissions = relayer_info.failed_submissions + 1;
            }

            self.relayers.write(relayer_id, relayer_info);
        }

        fn add_earnings(ref self: ContractState, relayer_id: u256, amount: u256) {
            // Only coordinator can call this
            let caller = get_caller_address();
            assert(caller == self.coordinator.read(), 'Only coordinator');

            let mut relayer_info = self.relayers.read(relayer_id);
            relayer_info.total_earnings = relayer_info.total_earnings + amount;
            self.relayers.write(relayer_id, relayer_info);
        }

        fn slash_relayer(ref self: ContractState, relayer_id: u256, penalty_bps: u256) {
            // Only coordinator can call this
            let caller = get_caller_address();
            assert(caller == self.coordinator.read(), 'Only coordinator');

            let mut relayer_info = self.relayers.read(relayer_id);

            // Calculate penalty (stake * penalty_bps / 10000)
            let penalty = (relayer_info.stake * penalty_bps) / 10000;
            let new_stake = relayer_info.stake - penalty;

            relayer_info.stake = new_stake;

            // Deactivate if stake falls below minimum
            let min_stake = self.min_stake.read();
            let mut deactivated = false;
            if new_stake < min_stake && relayer_info.active {
                relayer_info.active = false;
                self.active_relayer_count.write(self.active_relayer_count.read() - 1);
                deactivated = true;
            }

            self.relayers.write(relayer_id, relayer_info);

            self.emit(RelayerSlashed { relayer_id, penalty, new_stake, deactivated });
        }

        fn claim_earnings(ref self: ContractState) {
            let caller = get_caller_address();
            let relayer_id = self.address_to_id.read(caller);
            assert(relayer_id > 0, 'Not a registered relayer');

            let mut relayer_info = self.relayers.read(relayer_id);
            let earnings = relayer_info.total_earnings;
            assert(earnings > 0, 'No earnings to claim');

            // Reset earnings to 0
            relayer_info.total_earnings = 0;
            self.relayers.write(relayer_id, relayer_info);

            // Transfer earnings to relayer
            let token = IERC20Dispatcher { contract_address: self.stake_token.read() };
            let success = token.transfer(caller, earnings);
            assert(success, 'Earnings transfer failed');

            self.emit(EarningsClaimed { relayer_id, address: caller, amount: earnings });
        }

        fn set_coordinator(ref self: ContractState, coordinator: ContractAddress) {
            // Only owner can set coordinator
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');

            self.coordinator.write(coordinator);
            self.emit(CoordinatorSet { coordinator });
        }

        fn get_min_stake(self: @ContractState) -> u256 {
            self.min_stake.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}
