#[starknet::interface]
pub trait IShieldedPool<TContractState> {
    fn deposit(
        ref self: TContractState,
        token_address: starknet::ContractAddress,
        amount: u256,
        commitment: felt252,
    );
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
        token_address: starknet::ContractAddress,
        withdraw_amount: u256,
    );
    fn claim_withdrawal(
        ref self: TContractState,
        nullifier_hash: felt252,
        recipient: starknet::ContractAddress,
    );
    fn private_execute(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        token_address: starknet::ContractAddress,
        amount: u256,
        target_contract: starknet::ContractAddress,
        call_data: Span<felt252>,
        change_commitment: felt252,
        change_amount: u256,
    );
    fn is_nullifier_used(self: @TContractState, nullifier_hash: felt252) -> bool;
    fn get_commitment_count(self: @TContractState) -> u64;
    fn get_token_balance(self: @TContractState, token_address: starknet::ContractAddress) -> u256;
    fn get_last_root(self: @TContractState) -> felt252;
}

#[starknet::contract]
pub mod ShieldedPool {
    use starknet::{ContractAddress, get_caller_address, SyscallResultTrait};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use lisan_contracts::verifier::{verify_pool_withdraw, verify_pool_execute};
    use lisan_contracts::verifier::verify_pool_transfer;
    use lisan_contracts::merkle_tree::MerkleTreeComponent;

    component!(path: MerkleTreeComponent, storage: tree, event: TreeEvent);

    impl MerkleTreeInternalImpl = MerkleTreeComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        withdraw_verifier: ContractAddress,
        transfer_verifier: ContractAddress,
        nullifiers: Map<felt252, bool>,
        commitment_count: u64,
        token_balances: Map<ContractAddress, u256>,
        pending_withdrawals: Map<felt252, u256>,
        pending_token: Map<felt252, ContractAddress>,
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
        PrivateExecute: PrivateExecute,
        #[flat]
        TreeEvent: MerkleTreeComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub depositor: ContractAddress,
        #[key]
        pub token_address: ContractAddress,
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
        #[key]
        pub token_address: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Claim {
        pub nullifier_hash: felt252,
        pub recipient: ContractAddress,
        pub token_address: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrivateExecute {
        pub nullifier_hash: felt252,
        #[key]
        pub token_address: ContractAddress,
        pub target_contract: ContractAddress,
        pub amount: u256,
        pub change_amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        withdraw_verifier: ContractAddress,
        transfer_verifier: ContractAddress,
    ) {
        self.withdraw_verifier.write(withdraw_verifier);
        self.transfer_verifier.write(transfer_verifier);
        self.tree.initialize();
    }

    #[abi(embed_v0)]
    impl ShieldedPoolImpl of super::IShieldedPool<ContractState> {
        fn deposit(
            ref self: ContractState,
            token_address: ContractAddress,
            amount: u256,
            commitment: felt252,
        ) {
            assert(amount > 0, 'Amount must be > 0');

            let caller = get_caller_address();
            let token = IERC20Dispatcher { contract_address: token_address };
            let success = token.transfer_from(caller, starknet::get_contract_address(), amount);
            assert(success, 'Token transfer failed');

            // Insert commitment into Merkle tree
            let leaf_index = self.tree.insert(commitment);

            self.commitment_count.write(self.commitment_count.read() + 1);
            let current_balance = self.token_balances.read(token_address);
            self.token_balances.write(token_address, current_balance + amount);

            self.emit(Deposit { depositor: caller, token_address, amount, commitment, leaf_index });
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
            token_address: ContractAddress,
            withdraw_amount: u256,
        ) {
            // Check root is known
            assert(self.tree.is_known_root(root), 'Unknown Merkle root');

            // Check nullifier not already used (double-spend prevention)
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify ZK proof via Garaga verifier contract
            let withdraw_amount_felt: felt252 = withdraw_amount
                .try_into()
                .expect('Amount too large');
            let token_address_felt: felt252 = token_address.into();
            verify_pool_withdraw(
                self.withdraw_verifier.read(),
                full_proof_with_hints,
                root,
                nullifier_hash,
                token_address_felt,
                withdraw_amount_felt,
            );

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Escrow funds: store pending withdrawal amount and token keyed by nullifier_hash
            self.pending_withdrawals.write(nullifier_hash, withdraw_amount);
            self.pending_token.write(nullifier_hash, token_address);

            // Decrement commitment count
            self.commitment_count.write(self.commitment_count.read() - 1);

            // Decrement token balance
            let current_balance = self.token_balances.read(token_address);
            self.token_balances.write(token_address, current_balance - withdraw_amount);

            self.emit(PrepareWithdraw { nullifier_hash, token_address, amount: withdraw_amount });
        }

        fn claim_withdrawal(
            ref self: ContractState,
            nullifier_hash: felt252,
            recipient: ContractAddress,
        ) {
            let amount = self.pending_withdrawals.read(nullifier_hash);
            assert(amount > 0, 'No pending withdrawal');

            let token_address = self.pending_token.read(nullifier_hash);

            // Clear pending withdrawal
            self.pending_withdrawals.write(nullifier_hash, 0);

            // Transfer tokens from pool to recipient
            let token = IERC20Dispatcher { contract_address: token_address };
            let success = token.transfer(recipient, amount);
            assert(success, 'Token transfer failed');

            self.emit(Claim { nullifier_hash, recipient, token_address, amount });
        }

        fn private_execute(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            token_address: ContractAddress,
            amount: u256,
            target_contract: ContractAddress,
            call_data: Span<felt252>,
            change_commitment: felt252,
            change_amount: u256,
        ) {
            // Check root is known
            assert(self.tree.is_known_root(root), 'Unknown Merkle root');

            // Check nullifier not already used
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Total amount the user proves ownership of
            let total_amount = amount + change_amount;
            let total_amount_felt: felt252 = total_amount.try_into().expect('Amount too large');
            let token_address_felt: felt252 = token_address.into();

            // Verify ZK proof (proves ownership of commitment for total_amount of token_address)
            verify_pool_execute(
                self.withdraw_verifier.read(),
                full_proof_with_hints,
                root,
                nullifier_hash,
                token_address_felt,
                total_amount_felt,
            );

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Approve target_contract to spend `amount` of token
            let token = IERC20Dispatcher { contract_address: token_address };
            token.approve(target_contract, amount);

            // Call target contract with provided calldata
            // First element is the function selector, rest is calldata
            assert(call_data.len() > 0, 'Calldata must include selector');
            let entry_point_selector = *call_data.at(0);

            let mut calldata_arr: Array<felt252> = array![];
            let mut i: u32 = 1; // Start from index 1 (skip selector)
            loop {
                if i >= call_data.len() {
                    break;
                }
                calldata_arr.append(*call_data.at(i));
                i += 1;
            };
            starknet::syscalls::call_contract_syscall(
                target_contract, entry_point_selector, calldata_arr.span(),
            )
                .unwrap_syscall();

            // Reset approval
            token.approve(target_contract, 0);

            // If change_amount > 0, insert change commitment into Merkle tree
            if change_amount > 0 {
                assert(change_commitment != 0, 'Change commitment required');
                self.tree.insert(change_commitment);
                // Change stays in pool, commitment count increases
                self.commitment_count.write(self.commitment_count.read() + 1);
            } else {
                // Commitment consumed, count decreases
                self.commitment_count.write(self.commitment_count.read() - 1);
            }

            // Decrement token_balances by amount spent externally (change stays in pool)
            let current_balance = self.token_balances.read(token_address);
            self.token_balances.write(token_address, current_balance - amount);

            self
                .emit(
                    PrivateExecute {
                        nullifier_hash, token_address, target_contract, amount, change_amount,
                    },
                );
        }

        fn is_nullifier_used(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_commitment_count(self: @ContractState) -> u64 {
            self.commitment_count.read()
        }

        fn get_token_balance(self: @ContractState, token_address: ContractAddress) -> u256 {
            self.token_balances.read(token_address)
        }

        fn get_last_root(self: @ContractState) -> felt252 {
            self.tree.get_last_root()
        }
    }
}
