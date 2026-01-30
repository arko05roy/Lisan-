#[starknet::interface]
pub trait IShieldedPool<TContractState> {
    fn deposit(ref self: TContractState, amount: u256, commitment: felt252);
    fn transfer(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        new_commitment_sender: felt252,
        new_commitment_recipient: felt252,
    );
    fn prepare_withdraw(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        withdraw_amount: u256,
    );
    fn claim_withdrawal(
        ref self: TContractState,
        nullifier_hash: felt252,
        recipient: starknet::ContractAddress,
    );
    fn is_nullifier_used(self: @TContractState, nullifier_hash: felt252) -> bool;
    fn get_commitment_count(self: @TContractState) -> u64;
    fn get_total_deposited(self: @TContractState) -> u256;
    fn get_btc_token(self: @TContractState) -> starknet::ContractAddress;
    fn get_last_root(self: @TContractState) -> felt252;
}

#[starknet::contract]
pub mod ShieldedPool {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use lisan_contracts::verifier::{verify_pool_withdraw, verify_pool_transfer};
    use lisan_contracts::merkle_tree::MerkleTreeComponent;

    component!(path: MerkleTreeComponent, storage: tree, event: TreeEvent);

    impl MerkleTreeInternalImpl = MerkleTreeComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        btc_token: ContractAddress,
        withdraw_verifier: ContractAddress,
        transfer_verifier: ContractAddress,
        nullifiers: Map<felt252, bool>,
        commitment_count: u64,
        total_deposited: u256,
        pending_withdrawals: Map<felt252, u256>,
        #[substorage(v0)]
        tree: MerkleTreeComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposit: Deposit,
        Transfer: Transfer,
        PrepareWithdraw: PrepareWithdraw,
        Claim: Claim,
        #[flat]
        TreeEvent: MerkleTreeComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub depositor: ContractAddress,
        pub amount: u256,
        pub commitment: felt252,
        pub leaf_index: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        pub nullifier_hash: felt252,
        pub new_commitment_sender: felt252,
        pub new_commitment_recipient: felt252,
        pub leaf_index_sender: u32,
        pub leaf_index_recipient: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrepareWithdraw {
        pub nullifier_hash: felt252,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Claim {
        pub nullifier_hash: felt252,
        pub recipient: ContractAddress,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        btc_token: ContractAddress,
        withdraw_verifier: ContractAddress,
        transfer_verifier: ContractAddress,
    ) {
        self.btc_token.write(btc_token);
        self.withdraw_verifier.write(withdraw_verifier);
        self.transfer_verifier.write(transfer_verifier);
        self.tree.initialize();
    }

    #[abi(embed_v0)]
    impl ShieldedPoolImpl of super::IShieldedPool<ContractState> {
        fn deposit(ref self: ContractState, amount: u256, commitment: felt252) {
            assert(amount > 0, 'Amount must be > 0');

            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: self.btc_token.read() };
            let success = token.transfer_from(caller, starknet::get_contract_address(), amount);
            assert(success, 'Token transfer failed');

            // Insert commitment into Merkle tree
            let leaf_index = self.tree.insert(commitment);

            self.commitment_count.write(self.commitment_count.read() + 1);
            self.total_deposited.write(self.total_deposited.read() + amount);

            self.emit(Deposit { depositor: caller, amount, commitment, leaf_index });
        }

        fn transfer(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            new_commitment_sender: felt252,
            new_commitment_recipient: felt252,
        ) {
            // Check root is known
            assert(self.tree.is_known_root(root), 'Unknown Merkle root');

            // Check nullifier not already used (double-spend prevention)
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify ZK proof via Garaga verifier contract
            verify_pool_transfer(
                self.transfer_verifier.read(),
                full_proof_with_hints,
                root,
                nullifier_hash,
                new_commitment_sender,
                new_commitment_recipient,
            );

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Insert new commitments into Merkle tree
            let leaf_index_sender = self.tree.insert(new_commitment_sender);
            let leaf_index_recipient = self.tree.insert(new_commitment_recipient);

            // Net commitment count: +2 new (old is spent but still in tree)
            self.commitment_count.write(self.commitment_count.read() + 1);

            self
                .emit(
                    Transfer {
                        nullifier_hash,
                        new_commitment_sender,
                        new_commitment_recipient,
                        leaf_index_sender,
                        leaf_index_recipient,
                    },
                );
        }

        fn prepare_withdraw(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            withdraw_amount: u256,
        ) {
            // Check root is known
            assert(self.tree.is_known_root(root), 'Unknown Merkle root');

            // Check nullifier not already used (double-spend prevention)
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify ZK proof via Garaga verifier contract
            let withdraw_amount_felt: felt252 = withdraw_amount.try_into().expect('Amount too large');
            verify_pool_withdraw(
                self.withdraw_verifier.read(),
                full_proof_with_hints,
                root,
                nullifier_hash,
                withdraw_amount_felt,
            );

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Escrow funds: store pending withdrawal amount keyed by nullifier_hash
            self.pending_withdrawals.write(nullifier_hash, withdraw_amount);

            // Decrement commitment count
            self.commitment_count.write(self.commitment_count.read() - 1);

            // Decrement total deposited
            self.total_deposited.write(self.total_deposited.read() - withdraw_amount);

            self.emit(PrepareWithdraw { nullifier_hash, amount: withdraw_amount });
        }

        fn claim_withdrawal(
            ref self: ContractState,
            nullifier_hash: felt252,
            recipient: ContractAddress,
        ) {
            let amount = self.pending_withdrawals.read(nullifier_hash);
            assert(amount > 0, 'No pending withdrawal');

            // Clear pending withdrawal
            self.pending_withdrawals.write(nullifier_hash, 0);

            // Transfer tokens from pool to recipient
            let token = IERC20Dispatcher { contract_address: self.btc_token.read() };
            let success = token.transfer(recipient, amount);
            assert(success, 'Token transfer failed');

            self.emit(Claim { nullifier_hash, recipient, amount });
        }

        fn is_nullifier_used(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_commitment_count(self: @ContractState) -> u64 {
            self.commitment_count.read()
        }

        fn get_total_deposited(self: @ContractState) -> u256 {
            self.total_deposited.read()
        }

        fn get_btc_token(self: @ContractState) -> ContractAddress {
            self.btc_token.read()
        }

        fn get_last_root(self: @ContractState) -> felt252 {
            self.tree.get_last_root()
        }
    }
}
