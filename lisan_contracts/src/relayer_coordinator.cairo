use starknet::ContractAddress;

#[starknet::interface]
pub trait IRelayerCoordinator<TContractState> {
    fn select_relayer(ref self: TContractState) -> u256;
    fn submit_transfer_via_relayer(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        new_commitment_sender: felt252,
        new_commitment_recipient: felt252,
        relayer_id: u256,
        fee_amount: u256,
    );
    fn submit_withdraw_via_relayer(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        token_address: ContractAddress,
        withdraw_amount: u256,
        relayer_id: u256,
        fee_amount: u256,
    );
    fn submit_execute_via_relayer(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        token_address: ContractAddress,
        amount: u256,
        target_contract: ContractAddress,
        call_data: Span<felt252>,
        change_commitment: felt252,
        change_amount: u256,
        relayer_id: u256,
        fee_amount: u256,
    );
    fn get_estimated_fee(self: @TContractState, tx_amount: u256) -> u256;
    fn set_fee_bps(ref self: TContractState, fee_bps: u256);
    fn get_fee_bps(self: @TContractState) -> u256;
    fn get_slash_penalty_bps(self: @TContractState) -> u256;
    fn get_max_failures(self: @TContractState) -> u256;
    fn get_owner(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod RelayerCoordinator {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use lisan_contracts::relayer_registry::{
        IRelayerRegistryDispatcher, IRelayerRegistryDispatcherTrait,
    };
    use lisan_contracts::shielded_pool::{IShieldedPoolDispatcher, IShieldedPoolDispatcherTrait};

    #[storage]
    struct Storage {
        relayer_registry: ContractAddress,
        shielded_pool: ContractAddress,
        next_relayer_index: u256,
        relayer_fee_bps: u256,
        slash_penalty_bps: u256,
        max_failures_before_full_slash: u256,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TransferSuccess: TransferSuccess,
        TransferFailure: TransferFailure,
        WithdrawSuccess: WithdrawSuccess,
        WithdrawFailure: WithdrawFailure,
        ExecuteSuccess: ExecuteSuccess,
        ExecuteFailure: ExecuteFailure,
        FeeUpdated: FeeUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransferSuccess {
        #[key]
        pub relayer_id: u256,
        pub fee: u256,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransferFailure {
        #[key]
        pub relayer_id: u256,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawSuccess {
        #[key]
        pub relayer_id: u256,
        pub fee: u256,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawFailure {
        #[key]
        pub relayer_id: u256,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ExecuteSuccess {
        #[key]
        pub relayer_id: u256,
        pub fee: u256,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ExecuteFailure {
        #[key]
        pub relayer_id: u256,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FeeUpdated {
        pub old_fee_bps: u256,
        pub new_fee_bps: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        relayer_registry: ContractAddress,
        shielded_pool: ContractAddress,
        relayer_fee_bps: u256,
        slash_penalty_bps: u256,
        max_failures_before_full_slash: u256,
        owner: ContractAddress,
    ) {
        self.relayer_registry.write(relayer_registry);
        self.shielded_pool.write(shielded_pool);
        self.next_relayer_index.write(0);
        self.relayer_fee_bps.write(relayer_fee_bps);
        self.slash_penalty_bps.write(slash_penalty_bps);
        self.max_failures_before_full_slash.write(max_failures_before_full_slash);
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl RelayerCoordinatorImpl of super::IRelayerCoordinator<ContractState> {
        fn select_relayer(ref self: ContractState) -> u256 {
            let registry = IRelayerRegistryDispatcher {
                contract_address: self.relayer_registry.read(),
            };

            let active_count = registry.get_active_relayer_count();
            assert(active_count > 0, 'No active relayers');

            let total_count = registry.get_relayer_count();

            // Find next active relayer using round-robin
            let start_index = self.next_relayer_index.read();
            let mut current = start_index + 1;

            // Wrap around if we exceed total count
            if current > total_count {
                current = 1;
            }

            // Search for next active relayer (max iterations = total_count to avoid infinite loop)
            let mut iterations = 0;
            loop {
                if iterations >= total_count {
                    // Should never happen if active_count > 0, but safety check
                    panic!("Could not find active relayer");
                }

                if current > total_count {
                    current = 1;
                }

                if registry.is_relayer_active(current) {
                    self.next_relayer_index.write(current);
                    break current;
                }

                current = current + 1;
                iterations = iterations + 1;
            }
        }

        fn submit_transfer_via_relayer(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            new_commitment_sender: felt252,
            new_commitment_recipient: felt252,
            relayer_id: u256,
            fee_amount: u256,
        ) {
            let registry = IRelayerRegistryDispatcher {
                contract_address: self.relayer_registry.read(),
            };

            // Verify relayer is active
            assert(registry.is_relayer_active(relayer_id), 'Relayer inactive');

            // Forward proof to ShieldedPool
            let pool = IShieldedPoolDispatcher { contract_address: self.shielded_pool.read() };

            // Try to execute transfer - we'll use a simple pattern here
            // In production, you'd want better error handling
            let success = self
                ._try_transfer(
                    pool,
                    full_proof_with_hints,
                    root,
                    nullifier_hash,
                    new_commitment_sender,
                    new_commitment_recipient,
                );

            if success {
                // Record successful submission
                registry.record_submission(relayer_id, true);

                // Add earnings to relayer
                registry.add_earnings(relayer_id, fee_amount);

                self.emit(TransferSuccess { relayer_id, fee: fee_amount, nullifier_hash });
            } else {
                // Record failed submission
                registry.record_submission(relayer_id, false);

                // Handle failed submission with slashing
                self._handle_failed_submission(relayer_id);

                self.emit(TransferFailure { relayer_id, nullifier_hash });
            }
        }

        fn submit_withdraw_via_relayer(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            token_address: ContractAddress,
            withdraw_amount: u256,
            relayer_id: u256,
            fee_amount: u256,
        ) {
            let registry = IRelayerRegistryDispatcher {
                contract_address: self.relayer_registry.read(),
            };

            // Verify relayer is active
            assert(registry.is_relayer_active(relayer_id), 'Relayer inactive');

            // Forward proof to ShieldedPool
            let pool = IShieldedPoolDispatcher { contract_address: self.shielded_pool.read() };

            let success = self
                ._try_withdraw(
                    pool, full_proof_with_hints, root, nullifier_hash, token_address, withdraw_amount,
                );

            if success {
                registry.record_submission(relayer_id, true);
                registry.add_earnings(relayer_id, fee_amount);
                self.emit(WithdrawSuccess { relayer_id, fee: fee_amount, nullifier_hash });
            } else {
                registry.record_submission(relayer_id, false);
                self._handle_failed_submission(relayer_id);
                self.emit(WithdrawFailure { relayer_id, nullifier_hash });
            }
        }

        fn submit_execute_via_relayer(
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
            relayer_id: u256,
            fee_amount: u256,
        ) {
            let registry = IRelayerRegistryDispatcher {
                contract_address: self.relayer_registry.read(),
            };

            // Verify relayer is active
            assert(registry.is_relayer_active(relayer_id), 'Relayer inactive');

            // Forward proof to ShieldedPool
            let pool = IShieldedPoolDispatcher { contract_address: self.shielded_pool.read() };

            let success = self
                ._try_execute(
                    pool,
                    full_proof_with_hints,
                    root,
                    nullifier_hash,
                    token_address,
                    amount,
                    target_contract,
                    call_data,
                    change_commitment,
                    change_amount,
                );

            if success {
                registry.record_submission(relayer_id, true);
                registry.add_earnings(relayer_id, fee_amount);
                self.emit(ExecuteSuccess { relayer_id, fee: fee_amount, nullifier_hash });
            } else {
                registry.record_submission(relayer_id, false);
                self._handle_failed_submission(relayer_id);
                self.emit(ExecuteFailure { relayer_id, nullifier_hash });
            }
        }

        fn get_estimated_fee(self: @ContractState, tx_amount: u256) -> u256 {
            let fee_bps = self.relayer_fee_bps.read();
            (tx_amount * fee_bps) / 10000
        }

        fn set_fee_bps(ref self: ContractState, fee_bps: u256) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');

            let old_fee = self.relayer_fee_bps.read();
            self.relayer_fee_bps.write(fee_bps);

            self.emit(FeeUpdated { old_fee_bps: old_fee, new_fee_bps: fee_bps });
        }

        fn get_fee_bps(self: @ContractState) -> u256 {
            self.relayer_fee_bps.read()
        }

        fn get_slash_penalty_bps(self: @ContractState) -> u256 {
            self.slash_penalty_bps.read()
        }

        fn get_max_failures(self: @ContractState) -> u256 {
            self.max_failures_before_full_slash.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _try_transfer(
            ref self: ContractState,
            pool: IShieldedPoolDispatcher,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            new_commitment_sender: felt252,
            new_commitment_recipient: felt252,
        ) -> bool {
            // In Cairo, we can't directly catch panics, so we assume success
            // The pool contract will panic on failure
            // In production, you might want to use try/catch patterns if available
            pool
                .transfer(
                    full_proof_with_hints,
                    root,
                    nullifier_hash,
                    new_commitment_sender,
                    new_commitment_recipient,
                );
            true
        }

        fn _try_withdraw(
            ref self: ContractState,
            pool: IShieldedPoolDispatcher,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            token_address: ContractAddress,
            withdraw_amount: u256,
        ) -> bool {
            pool.prepare_withdraw(full_proof_with_hints, root, nullifier_hash, token_address, withdraw_amount);
            true
        }

        fn _try_execute(
            ref self: ContractState,
            pool: IShieldedPoolDispatcher,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            token_address: ContractAddress,
            amount: u256,
            target_contract: ContractAddress,
            call_data: Span<felt252>,
            change_commitment: felt252,
            change_amount: u256,
        ) -> bool {
            pool
                .private_execute(
                    full_proof_with_hints,
                    root,
                    nullifier_hash,
                    token_address,
                    amount,
                    target_contract,
                    call_data,
                    change_commitment,
                    change_amount,
                );
            true
        }

        fn _handle_failed_submission(ref self: ContractState, relayer_id: u256) {
            let registry = IRelayerRegistryDispatcher {
                contract_address: self.relayer_registry.read(),
            };

            let relayer_info = registry.get_relayer_info(relayer_id);

            // Slash penalty (10% by default)
            registry.slash_relayer(relayer_id, self.slash_penalty_bps.read());

            // Check if we should fully slash (3 failures by default)
            if relayer_info.failed_submissions >= self.max_failures_before_full_slash.read() {
                // Full slash (100%)
                registry.slash_relayer(relayer_id, 10000);
            }
        }
    }
}
