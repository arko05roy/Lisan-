#[starknet::interface]
pub trait IDemoCounter<TContractState> {
    fn increment(ref self: TContractState);
    fn get_count(self: @TContractState) -> u32;
    fn get_last_caller(self: @TContractState) -> starknet::ContractAddress;
}

#[starknet::contract]
pub mod DemoCounter {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        count: u32,
        last_caller: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Incremented: Incremented,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Incremented {
        #[key]
        pub caller: ContractAddress,
        pub new_count: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.count.write(0);
    }

    #[abi(embed_v0)]
    impl DemoCounterImpl of super::IDemoCounter<ContractState> {
        fn increment(ref self: ContractState) {
            let caller = get_caller_address();
            let new_count = self.count.read() + 1;
            self.count.write(new_count);
            self.last_caller.write(caller);

            self.emit(Incremented { caller, new_count });
        }

        fn get_count(self: @ContractState) -> u32 {
            self.count.read()
        }

        fn get_last_caller(self: @ContractState) -> ContractAddress {
            self.last_caller.read()
        }
    }
}
