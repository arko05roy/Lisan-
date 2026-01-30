#[starknet::interface]
pub trait IShieldedAMM<TContractState> {
    fn seed_liquidity(ref self: TContractState, btc_amount: u256, strk_amount: u256);
    fn deposit(ref self: TContractState, token_type: felt252, amount: u256, commitment: felt252);
    fn swap(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        token_type_in: felt252,
        amount_in: felt252,
        token_type_out: felt252,
        new_commitment: felt252,
        amount_out: felt252,
    );
    fn prepare_withdraw(
        ref self: TContractState,
        full_proof_with_hints: Span<felt252>,
        root: felt252,
        nullifier_hash: felt252,
        token_type: felt252,
        withdraw_amount: u256,
    );
    fn claim_withdrawal(
        ref self: TContractState,
        nullifier_hash: felt252,
        recipient: starknet::ContractAddress,
    );
    fn get_amount_out(
        self: @TContractState, amount_in: u256, token_type_in: felt252, token_type_out: felt252,
    ) -> u256;
    fn get_btc_reserve(self: @TContractState) -> u256;
    fn get_strk_reserve(self: @TContractState) -> u256;
    fn is_nullifier_used(self: @TContractState, nullifier_hash: felt252) -> bool;
    fn get_commitment_count(self: @TContractState) -> u64;
    fn is_seeded(self: @TContractState) -> bool;
    fn get_btc_token(self: @TContractState) -> starknet::ContractAddress;
    fn get_strk_token(self: @TContractState) -> starknet::ContractAddress;
    fn get_last_root(self: @TContractState) -> felt252;
}

#[starknet::contract]
pub mod ShieldedAMM {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use lisan_contracts::verifier::{verify_amm_swap, verify_amm_withdraw};
    use lisan_contracts::merkle_tree::MerkleTreeComponent;

    const TOKEN_TYPE_BTC: felt252 = 1;
    const TOKEN_TYPE_STRK: felt252 = 2;

    component!(path: MerkleTreeComponent, storage: tree, event: TreeEvent);

    impl MerkleTreeInternalImpl = MerkleTreeComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        btc_token: ContractAddress,
        strk_token: ContractAddress,
        swap_verifier: ContractAddress,
        withdraw_verifier: ContractAddress,
        btc_reserve: u256,
        strk_reserve: u256,
        nullifiers: Map<felt252, bool>,
        commitment_count: u64,
        seeded: bool,
        pending_withdrawals: Map<felt252, u256>,
        pending_token_type: Map<felt252, felt252>,
        #[substorage(v0)]
        tree: MerkleTreeComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        LiquiditySeeded: LiquiditySeeded,
        Deposit: Deposit,
        Swap: Swap,
        PrepareWithdraw: PrepareWithdraw,
        Claim: Claim,
        #[flat]
        TreeEvent: MerkleTreeComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LiquiditySeeded {
        pub btc_amount: u256,
        pub strk_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub depositor: ContractAddress,
        pub token_type: felt252,
        pub amount: u256,
        pub commitment: felt252,
        pub leaf_index: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Swap {
        pub nullifier_hash: felt252,
        pub token_type_in: felt252,
        pub token_type_out: felt252,
        pub new_commitment: felt252,
        pub leaf_index: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrepareWithdraw {
        pub nullifier_hash: felt252,
        pub token_type: felt252,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Claim {
        pub nullifier_hash: felt252,
        pub recipient: ContractAddress,
        pub token_type: felt252,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        btc_token: ContractAddress,
        strk_token: ContractAddress,
        swap_verifier: ContractAddress,
        withdraw_verifier: ContractAddress,
    ) {
        self.owner.write(owner);
        self.btc_token.write(btc_token);
        self.strk_token.write(strk_token);
        self.swap_verifier.write(swap_verifier);
        self.withdraw_verifier.write(withdraw_verifier);
        self.tree.initialize();
    }

    #[abi(embed_v0)]
    impl ShieldedAMMImpl of super::IShieldedAMM<ContractState> {
        fn seed_liquidity(ref self: ContractState, btc_amount: u256, strk_amount: u256) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner can seed');
            assert(!self.seeded.read(), 'Already seeded');
            assert(btc_amount > 0, 'BTC amount must be > 0');
            assert(strk_amount > 0, 'STRK amount must be > 0');

            let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
            let strk = IERC20Dispatcher { contract_address: self.strk_token.read() };

            let success_btc = btc.transfer_from(caller, get_contract_address(), btc_amount);
            assert(success_btc, 'BTC transfer failed');

            let success_strk = strk.transfer_from(caller, get_contract_address(), strk_amount);
            assert(success_strk, 'STRK transfer failed');

            self.btc_reserve.write(btc_amount);
            self.strk_reserve.write(strk_amount);
            self.seeded.write(true);

            self.emit(LiquiditySeeded { btc_amount, strk_amount });
        }

        fn deposit(
            ref self: ContractState, token_type: felt252, amount: u256, commitment: felt252,
        ) {
            assert(amount > 0, 'Amount must be > 0');
            assert(
                token_type == TOKEN_TYPE_BTC || token_type == TOKEN_TYPE_STRK,
                'Invalid token type',
            );

            let caller = get_caller_address();
            let token_address = if token_type == TOKEN_TYPE_BTC {
                self.btc_token.read()
            } else {
                self.strk_token.read()
            };

            let token = IERC20Dispatcher { contract_address: token_address };
            let success = token.transfer_from(caller, get_contract_address(), amount);
            assert(success, 'Token transfer failed');

            // Insert commitment into Merkle tree
            let leaf_index = self.tree.insert(commitment);

            self.commitment_count.write(self.commitment_count.read() + 1);

            self.emit(Deposit { depositor: caller, token_type, amount, commitment, leaf_index });
        }

        fn swap(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            token_type_in: felt252,
            amount_in: felt252,
            token_type_out: felt252,
            new_commitment: felt252,
            amount_out: felt252,
        ) {
            // Must be seeded before swapping
            assert(self.seeded.read(), 'AMM not seeded');

            // Validate token types
            assert(
                token_type_in == TOKEN_TYPE_BTC || token_type_in == TOKEN_TYPE_STRK,
                'Invalid input token type',
            );
            assert(
                token_type_out == TOKEN_TYPE_BTC || token_type_out == TOKEN_TYPE_STRK,
                'Invalid output token type',
            );

            // Check root is known
            assert(self.tree.is_known_root(root), 'Unknown Merkle root');

            // Check nullifier not already used
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify ZK proof via Garaga verifier contract
            verify_amm_swap(
                self.swap_verifier.read(),
                full_proof_with_hints,
                root,
                nullifier_hash,
                token_type_in,
                amount_in,
                token_type_out,
                new_commitment,
                amount_out,
            );

            // Calculate expected output using constant product formula: x * y = k
            let amount_in_u256: u256 = amount_in.into();
            let (reserve_in, reserve_out) = if token_type_in == TOKEN_TYPE_BTC {
                (self.btc_reserve.read(), self.strk_reserve.read())
            } else {
                (self.strk_reserve.read(), self.btc_reserve.read())
            };

            assert(reserve_in > 0 && reserve_out > 0, 'Reserves empty');

            // amount_out = (reserve_out * amount_in) / (reserve_in + amount_in)
            let calculated_out: u256 = (reserve_out * amount_in_u256)
                / (reserve_in + amount_in_u256);

            // Verify user's expected output matches AMM calculation
            let user_amount_out: u256 = amount_out.into();
            assert(user_amount_out == calculated_out, 'Amount out mismatch');

            // Update reserves
            if token_type_in == TOKEN_TYPE_BTC {
                self.btc_reserve.write(reserve_in + amount_in_u256);
                self.strk_reserve.write(reserve_out - calculated_out);
            } else {
                self.strk_reserve.write(reserve_in + amount_in_u256);
                self.btc_reserve.write(reserve_out - calculated_out);
            };

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Insert new commitment into Merkle tree
            let leaf_index = self.tree.insert(new_commitment);

            self
                .emit(
                    Swap {
                        nullifier_hash, token_type_in, token_type_out, new_commitment, leaf_index,
                    },
                );
        }

        fn prepare_withdraw(
            ref self: ContractState,
            full_proof_with_hints: Span<felt252>,
            root: felt252,
            nullifier_hash: felt252,
            token_type: felt252,
            withdraw_amount: u256,
        ) {
            // Validate token type
            assert(
                token_type == TOKEN_TYPE_BTC || token_type == TOKEN_TYPE_STRK,
                'Invalid token type',
            );

            // Check root is known
            assert(self.tree.is_known_root(root), 'Unknown Merkle root');

            // Check nullifier not already used
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify ZK proof via Garaga verifier contract
            let withdraw_amount_felt: felt252 = withdraw_amount.try_into().expect('Amount too large');
            verify_amm_withdraw(
                self.withdraw_verifier.read(),
                full_proof_with_hints,
                root,
                nullifier_hash,
                token_type,
                withdraw_amount_felt,
            );

            // Mark nullifier as used
            self.nullifiers.write(nullifier_hash, true);

            // Escrow funds: store pending withdrawal keyed by nullifier_hash
            self.pending_withdrawals.write(nullifier_hash, withdraw_amount);
            self.pending_token_type.write(nullifier_hash, token_type);

            // Decrement commitment count
            self.commitment_count.write(self.commitment_count.read() - 1);

            self.emit(PrepareWithdraw { nullifier_hash, token_type, amount: withdraw_amount });
        }

        fn claim_withdrawal(
            ref self: ContractState,
            nullifier_hash: felt252,
            recipient: ContractAddress,
        ) {
            let amount = self.pending_withdrawals.read(nullifier_hash);
            assert(amount > 0, 'No pending withdrawal');

            let token_type = self.pending_token_type.read(nullifier_hash);

            // Clear pending withdrawal
            self.pending_withdrawals.write(nullifier_hash, 0);
            self.pending_token_type.write(nullifier_hash, 0);

            // Transfer tokens to recipient
            let token_address = if token_type == TOKEN_TYPE_BTC {
                self.btc_token.read()
            } else {
                self.strk_token.read()
            };

            let token = IERC20Dispatcher { contract_address: token_address };
            let success = token.transfer(recipient, amount);
            assert(success, 'Token transfer failed');

            self.emit(Claim { nullifier_hash, recipient, token_type, amount });
        }

        fn get_amount_out(
            self: @ContractState,
            amount_in: u256,
            token_type_in: felt252,
            token_type_out: felt252,
        ) -> u256 {
            assert(token_type_in != token_type_out, 'Same token type');
            assert(
                token_type_in == TOKEN_TYPE_BTC || token_type_in == TOKEN_TYPE_STRK,
                'Invalid input token type',
            );
            assert(
                token_type_out == TOKEN_TYPE_BTC || token_type_out == TOKEN_TYPE_STRK,
                'Invalid output token type',
            );
            assert(amount_in > 0, 'Amount must be > 0');

            let (reserve_in, reserve_out) = if token_type_in == TOKEN_TYPE_BTC {
                (self.btc_reserve.read(), self.strk_reserve.read())
            } else {
                (self.strk_reserve.read(), self.btc_reserve.read())
            };

            assert(reserve_in > 0 && reserve_out > 0, 'Reserves empty');

            (reserve_out * amount_in) / (reserve_in + amount_in)
        }

        fn get_btc_reserve(self: @ContractState) -> u256 {
            self.btc_reserve.read()
        }

        fn get_strk_reserve(self: @ContractState) -> u256 {
            self.strk_reserve.read()
        }

        fn is_nullifier_used(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_commitment_count(self: @ContractState) -> u64 {
            self.commitment_count.read()
        }

        fn is_seeded(self: @ContractState) -> bool {
            self.seeded.read()
        }

        fn get_btc_token(self: @ContractState) -> ContractAddress {
            self.btc_token.read()
        }

        fn get_strk_token(self: @ContractState) -> ContractAddress {
            self.strk_token.read()
        }

        fn get_last_root(self: @ContractState) -> felt252 {
            self.tree.get_last_root()
        }
    }
}
