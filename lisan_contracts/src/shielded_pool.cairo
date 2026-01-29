#[starknet::interface]
pub trait IShieldedPool<TContractState> {
    fn deposit(ref self: TContractState, amount: u256, commitment: felt252);
    fn transfer(
        ref self: TContractState,
        old_commitment: felt252,
        nullifier_hash: felt252,
        old_amount: felt252,
        old_secret: felt252,
        old_nullifier_secret: felt252,
        new_commitment_sender: felt252,
        new_commitment_recipient: felt252,
        change_amount: felt252,
        transfer_amount: felt252,
        new_secret_sender: felt252,
        new_nullifier_secret_sender: felt252,
        new_secret_recipient: felt252,
        new_nullifier_secret_recipient: felt252,
    );
    fn is_commitment_valid(self: @TContractState, commitment: felt252) -> bool;
    fn get_commitment_count(self: @TContractState) -> u64;
    fn get_total_deposited(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod ShieldedPool {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use lisan_contracts::verifier::verify_transfer_proof;

    #[storage]
    struct Storage {
        btc_token: ContractAddress,
        commitments: Map<felt252, bool>,
        nullifiers: Map<felt252, bool>,
        commitment_count: u64,
        total_deposited: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposit: Deposit,
        Transfer: Transfer,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub depositor: ContractAddress,
        pub amount: u256,
        pub commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        pub nullifier_hash: felt252,
        pub new_commitment_sender: felt252,
        pub new_commitment_recipient: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, btc_token: ContractAddress) {
        self.btc_token.write(btc_token);
    }

    #[abi(embed_v0)]
    impl ShieldedPoolImpl of super::IShieldedPool<ContractState> {
        fn deposit(ref self: ContractState, amount: u256, commitment: felt252) {
            assert(amount > 0, 'Amount must be > 0');
            assert(!self.commitments.read(commitment), 'Commitment already exists');

            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: self.btc_token.read() };
            let success = token.transfer_from(caller, starknet::get_contract_address(), amount);
            assert(success, 'Token transfer failed');

            self.commitments.write(commitment, true);
            self.commitment_count.write(self.commitment_count.read() + 1);
            self.total_deposited.write(self.total_deposited.read() + amount);

            self.emit(Deposit { depositor: caller, amount, commitment });
        }

        fn transfer(
            ref self: ContractState,
            old_commitment: felt252,
            nullifier_hash: felt252,
            old_amount: felt252,
            old_secret: felt252,
            old_nullifier_secret: felt252,
            new_commitment_sender: felt252,
            new_commitment_recipient: felt252,
            change_amount: felt252,
            transfer_amount: felt252,
            new_secret_sender: felt252,
            new_nullifier_secret_sender: felt252,
            new_secret_recipient: felt252,
            new_nullifier_secret_recipient: felt252,
        ) {
            // Check old commitment exists
            assert(self.commitments.read(old_commitment), 'Commitment does not exist');

            // Check nullifier not already used (double-spend prevention)
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify all transfer constraints
            let valid = verify_transfer_proof(
                old_commitment,
                old_amount,
                old_secret,
                old_nullifier_secret,
                nullifier_hash,
                new_commitment_sender,
                new_commitment_recipient,
                change_amount,
                transfer_amount,
                new_secret_sender,
                new_nullifier_secret_sender,
                new_secret_recipient,
                new_nullifier_secret_recipient,
            );
            assert(valid, 'Invalid transfer proof');

            // Invalidate old commitment
            self.commitments.write(old_commitment, false);

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Add new commitments
            self.commitments.write(new_commitment_sender, true);
            self.commitments.write(new_commitment_recipient, true);

            // Net commitment count: -1 old + 2 new = +1
            self.commitment_count.write(self.commitment_count.read() + 1);

            self
                .emit(
                    Transfer { nullifier_hash, new_commitment_sender, new_commitment_recipient },
                );
        }

        fn is_commitment_valid(self: @ContractState, commitment: felt252) -> bool {
            self.commitments.read(commitment)
        }

        fn get_commitment_count(self: @ContractState) -> u64 {
            self.commitment_count.read()
        }

        fn get_total_deposited(self: @ContractState) -> u256 {
            self.total_deposited.read()
        }
    }
}
