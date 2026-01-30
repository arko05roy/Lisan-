#[starknet::interface]
pub trait IPredictionMarket<TContractState> {
    fn create_market(
        ref self: TContractState,
        question_hash: felt252,
        num_outcomes: felt252,
        resolution_time: u64,
    ) -> u64;
    fn place_bet(
        ref self: TContractState, market_id: u64, bet_commitment: felt252, amount: u256,
    );
    fn resolve(ref self: TContractState, market_id: u64);
    fn claim(
        ref self: TContractState,
        market_id: u64,
        full_proof_with_hints: Span<felt252>,
        bet_commitment: felt252,
        nullifier_hash: felt252,
        recipient: starknet::ContractAddress,
    );
    fn get_market_count(self: @TContractState) -> u64;
    fn get_market_question(self: @TContractState, market_id: u64) -> felt252;
    fn get_market_num_outcomes(self: @TContractState, market_id: u64) -> felt252;
    fn get_market_resolution_time(self: @TContractState, market_id: u64) -> u64;
    fn is_market_resolved(self: @TContractState, market_id: u64) -> bool;
    fn get_winning_outcome(self: @TContractState, market_id: u64) -> felt252;
    fn get_market_total_pool(self: @TContractState, market_id: u64) -> u256;
    fn get_market_remaining_pool(self: @TContractState, market_id: u64) -> u256;
    fn get_market_bet_count(self: @TContractState, market_id: u64) -> u64;
    fn is_bet_placed(self: @TContractState, bet_commitment: felt252) -> bool;
    fn is_bet_claimed(self: @TContractState, bet_commitment: felt252) -> bool;
    fn is_nullifier_used(self: @TContractState, nullifier_hash: felt252) -> bool;
    fn get_bet_market_id(self: @TContractState, bet_commitment: felt252) -> u64;
    fn get_oracle(self: @TContractState) -> starknet::ContractAddress;
    fn get_btc_token(self: @TContractState) -> starknet::ContractAddress;
}

#[starknet::contract]
pub mod PredictionMarket {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use openzeppelin_interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use lisan_contracts::mock_pragma_oracle::{
        IMockPragmaOracleDispatcher, IMockPragmaOracleDispatcherTrait,
    };
    use lisan_contracts::verifier::verify_bet_claim;

    #[storage]
    struct Storage {
        btc_token: ContractAddress,
        oracle: ContractAddress,
        bet_claim_verifier: ContractAddress,
        market_count: u64,
        // Per-market storage
        market_question: Map<u64, felt252>,
        market_num_outcomes: Map<u64, felt252>,
        market_resolution_time: Map<u64, u64>,
        market_creator: Map<u64, ContractAddress>,
        market_resolved: Map<u64, bool>,
        market_winning_outcome: Map<u64, felt252>,
        market_total_pool: Map<u64, u256>,
        market_remaining_pool: Map<u64, u256>,
        market_bet_count: Map<u64, u64>,
        market_exists: Map<u64, bool>,
        // Bet storage (globally unique commitments)
        bet_commitments: Map<felt252, bool>,
        bet_market_id: Map<felt252, u64>,
        bet_amounts: Map<felt252, u256>,
        bet_claimed: Map<felt252, bool>,
        // Nullifiers (prevent double-claiming)
        nullifiers: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MarketCreated: MarketCreated,
        BetPlaced: BetPlaced,
        MarketResolved: MarketResolved,
        BetClaimed: BetClaimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketCreated {
        #[key]
        pub market_id: u64,
        pub creator: ContractAddress,
        pub question_hash: felt252,
        pub num_outcomes: felt252,
        pub resolution_time: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetPlaced {
        #[key]
        pub market_id: u64,
        pub bet_commitment: felt252,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketResolved {
        #[key]
        pub market_id: u64,
        pub winning_outcome: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetClaimed {
        #[key]
        pub market_id: u64,
        pub bet_commitment: felt252,
        pub nullifier_hash: felt252,
        pub recipient: ContractAddress,
        pub payout: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        btc_token: ContractAddress,
        oracle: ContractAddress,
        bet_claim_verifier: ContractAddress,
    ) {
        self.btc_token.write(btc_token);
        self.oracle.write(oracle);
        self.bet_claim_verifier.write(bet_claim_verifier);
    }

    #[abi(embed_v0)]
    impl PredictionMarketImpl of super::IPredictionMarket<ContractState> {
        fn create_market(
            ref self: ContractState,
            question_hash: felt252,
            num_outcomes: felt252,
            resolution_time: u64,
        ) -> u64 {
            // Must have at least 2 outcomes
            assert(num_outcomes != 0 && num_outcomes != 1, 'Need at least 2 outcomes');

            // Resolution time must be in the future
            let current_time = get_block_timestamp();
            assert(resolution_time > current_time, 'Resolution time must be future');

            let market_id = self.market_count.read();
            let caller = get_caller_address();

            self.market_question.write(market_id, question_hash);
            self.market_num_outcomes.write(market_id, num_outcomes);
            self.market_resolution_time.write(market_id, resolution_time);
            self.market_creator.write(market_id, caller);
            self.market_exists.write(market_id, true);

            self.market_count.write(market_id + 1);

            self
                .emit(
                    MarketCreated {
                        market_id, creator: caller, question_hash, num_outcomes, resolution_time,
                    },
                );

            market_id
        }

        fn place_bet(
            ref self: ContractState, market_id: u64, bet_commitment: felt252, amount: u256,
        ) {
            // Market must exist
            assert(self.market_exists.read(market_id), 'Market does not exist');

            // Market must not be resolved
            assert(!self.market_resolved.read(market_id), 'Market already resolved');

            // Must be before resolution time
            let current_time = get_block_timestamp();
            let resolution_time = self.market_resolution_time.read(market_id);
            assert(current_time < resolution_time, 'Betting period ended');

            // Amount must be positive
            assert(amount > 0, 'Amount must be > 0');

            // Commitment must be unique (globally across all markets)
            assert(!self.bet_commitments.read(bet_commitment), 'Bet commitment exists');

            // Transfer BTC from bettor to contract
            let caller = get_caller_address();
            let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
            let success = btc.transfer_from(caller, get_contract_address(), amount);
            assert(success, 'Token transfer failed');

            // Store bet data
            self.bet_commitments.write(bet_commitment, true);
            self.bet_market_id.write(bet_commitment, market_id);
            self.bet_amounts.write(bet_commitment, amount);

            // Update market pool
            let current_pool = self.market_total_pool.read(market_id);
            self.market_total_pool.write(market_id, current_pool + amount);
            let remaining = self.market_remaining_pool.read(market_id);
            self.market_remaining_pool.write(market_id, remaining + amount);

            // Increment bet count
            let bet_count = self.market_bet_count.read(market_id);
            self.market_bet_count.write(market_id, bet_count + 1);

            self.emit(BetPlaced { market_id, bet_commitment, amount });
        }

        fn resolve(ref self: ContractState, market_id: u64) {
            // Market must exist
            assert(self.market_exists.read(market_id), 'Market does not exist');

            // Must not already be resolved
            assert(!self.market_resolved.read(market_id), 'Already resolved');

            // Must be past resolution time
            let current_time = get_block_timestamp();
            let resolution_time = self.market_resolution_time.read(market_id);
            assert(current_time >= resolution_time, 'Too early to resolve');

            // Query oracle for result
            let oracle = IMockPragmaOracleDispatcher { contract_address: self.oracle.read() };
            assert(oracle.has_result(market_id), 'Oracle has no result');
            let winning_outcome = oracle.get_result(market_id);

            // Store resolution
            self.market_resolved.write(market_id, true);
            self.market_winning_outcome.write(market_id, winning_outcome);

            self.emit(MarketResolved { market_id, winning_outcome });
        }

        fn claim(
            ref self: ContractState,
            market_id: u64,
            full_proof_with_hints: Span<felt252>,
            bet_commitment: felt252,
            nullifier_hash: felt252,
            recipient: ContractAddress,
        ) {
            // Market must be resolved
            assert(self.market_resolved.read(market_id), 'Market not resolved');

            // Bet must exist
            assert(self.bet_commitments.read(bet_commitment), 'Bet does not exist');

            // Bet must belong to this market
            assert(
                self.bet_market_id.read(bet_commitment) == market_id, 'Bet not in this market',
            );

            // Bet must not already be claimed
            assert(!self.bet_claimed.read(bet_commitment), 'Already claimed');

            // Nullifier must not be used (double-claim prevention)
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // Verify ZK proof via Garaga verifier contract
            let winning_outcome = self.market_winning_outcome.read(market_id);
            verify_bet_claim(
                self.bet_claim_verifier.read(),
                full_proof_with_hints,
                bet_commitment,
                nullifier_hash,
                winning_outcome,
            );

            // Get stored bet amount for payout calculation
            let stored_amount = self.bet_amounts.read(bet_commitment);

            // Calculate payout: amount * num_outcomes (fair odds), capped at remaining pool
            let num_outcomes = self.market_num_outcomes.read(market_id);
            let multiplier: u256 = num_outcomes.into();
            let ideal_payout: u256 = stored_amount * multiplier;
            let remaining_pool = self.market_remaining_pool.read(market_id);
            let payout = if ideal_payout > remaining_pool {
                remaining_pool
            } else {
                ideal_payout
            };

            // Mark as claimed
            self.bet_claimed.write(bet_commitment, true);
            self.nullifiers.write(nullifier_hash, true);

            // Update remaining pool
            self.market_remaining_pool.write(market_id, remaining_pool - payout);

            // Transfer payout to recipient
            let btc = IERC20Dispatcher { contract_address: self.btc_token.read() };
            let success = btc.transfer(recipient, payout);
            assert(success, 'Token transfer failed');

            self
                .emit(
                    BetClaimed {
                        market_id, bet_commitment, nullifier_hash, recipient, payout,
                    },
                );
        }

        // ---- View functions ----

        fn get_market_count(self: @ContractState) -> u64 {
            self.market_count.read()
        }

        fn get_market_question(self: @ContractState, market_id: u64) -> felt252 {
            self.market_question.read(market_id)
        }

        fn get_market_num_outcomes(self: @ContractState, market_id: u64) -> felt252 {
            self.market_num_outcomes.read(market_id)
        }

        fn get_market_resolution_time(self: @ContractState, market_id: u64) -> u64 {
            self.market_resolution_time.read(market_id)
        }

        fn is_market_resolved(self: @ContractState, market_id: u64) -> bool {
            self.market_resolved.read(market_id)
        }

        fn get_winning_outcome(self: @ContractState, market_id: u64) -> felt252 {
            self.market_winning_outcome.read(market_id)
        }

        fn get_market_total_pool(self: @ContractState, market_id: u64) -> u256 {
            self.market_total_pool.read(market_id)
        }

        fn get_market_remaining_pool(self: @ContractState, market_id: u64) -> u256 {
            self.market_remaining_pool.read(market_id)
        }

        fn get_market_bet_count(self: @ContractState, market_id: u64) -> u64 {
            self.market_bet_count.read(market_id)
        }

        fn is_bet_placed(self: @ContractState, bet_commitment: felt252) -> bool {
            self.bet_commitments.read(bet_commitment)
        }

        fn is_bet_claimed(self: @ContractState, bet_commitment: felt252) -> bool {
            self.bet_claimed.read(bet_commitment)
        }

        fn is_nullifier_used(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_bet_market_id(self: @ContractState, bet_commitment: felt252) -> u64 {
            self.bet_market_id.read(bet_commitment)
        }

        fn get_oracle(self: @ContractState) -> ContractAddress {
            self.oracle.read()
        }

        fn get_btc_token(self: @ContractState) -> ContractAddress {
            self.btc_token.read()
        }
    }
}
