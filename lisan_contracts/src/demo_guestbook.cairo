#[starknet::interface]
pub trait IDemoGuestbook<TContractState> {
    fn sign(ref self: TContractState, message: felt252);
    fn get_entry_count(self: @TContractState) -> u32;
    fn get_entry(self: @TContractState, index: u32) -> (starknet::ContractAddress, felt252);
}

#[starknet::contract]
pub mod DemoGuestbook {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };

    #[storage]
    struct Storage {
        entries: Map<u32, (ContractAddress, felt252)>,
        count: u32,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Signed: Signed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Signed {
        #[key]
        pub signer: ContractAddress,
        pub message: felt252,
        pub index: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.count.write(0);
    }

    #[abi(embed_v0)]
    impl DemoGuestbookImpl of super::IDemoGuestbook<ContractState> {
        fn sign(ref self: ContractState, message: felt252) {
            let caller = get_caller_address();
            let index = self.count.read();

            self.entries.write(index, (caller, message));
            self.count.write(index + 1);

            self.emit(Signed { signer: caller, message, index });
        }

        fn get_entry_count(self: @ContractState) -> u32 {
            self.count.read()
        }

        fn get_entry(self: @ContractState, index: u32) -> (ContractAddress, felt252) {
            self.entries.read(index)
        }
    }
}
