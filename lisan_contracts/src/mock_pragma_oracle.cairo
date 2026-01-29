#[starknet::interface]
pub trait IMockPragmaOracle<TContractState> {
    fn set_result(ref self: TContractState, market_id: u64, winning_outcome: felt252);
    fn get_result(self: @TContractState, market_id: u64) -> felt252;
    fn has_result(self: @TContractState, market_id: u64) -> bool;
}

#[starknet::contract]
pub mod MockPragmaOracle {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        results: Map<u64, felt252>,
        result_exists: Map<u64, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ResultSet: ResultSet,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ResultSet {
        #[key]
        pub market_id: u64,
        pub winning_outcome: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl MockPragmaOracleImpl of super::IMockPragmaOracle<ContractState> {
        fn set_result(ref self: ContractState, market_id: u64, winning_outcome: felt252) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner can set result');
            self.results.write(market_id, winning_outcome);
            self.result_exists.write(market_id, true);
            self.emit(ResultSet { market_id, winning_outcome });
        }

        fn get_result(self: @ContractState, market_id: u64) -> felt252 {
            assert(self.result_exists.read(market_id), 'No result for market');
            self.results.read(market_id)
        }

        fn has_result(self: @ContractState, market_id: u64) -> bool {
            self.result_exists.read(market_id)
        }
    }
}
