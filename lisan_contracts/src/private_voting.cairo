#[derive(Drop, Copy, Serde)]
pub struct RevealedVote {
    pub vote_commitment: felt252,
    pub choice: felt252,
    pub secret: felt252,
    pub nullifier_secret: felt252,
}

#[starknet::interface]
pub trait IPrivateVoting<TContractState> {
    fn create_proposal(
        ref self: TContractState,
        description_hash: felt252,
        num_options: felt252,
        end_time: u64,
    ) -> u64;
    fn cast_vote(
        ref self: TContractState,
        proposal_id: u64,
        vote_commitment: felt252,
        nullifier_hash: felt252,
    );
    fn tally(
        ref self: TContractState, proposal_id: u64, revealed_votes: Span<RevealedVote>,
    );
    fn get_proposal_count(self: @TContractState) -> u64;
    fn get_proposal_description(self: @TContractState, proposal_id: u64) -> felt252;
    fn get_proposal_num_options(self: @TContractState, proposal_id: u64) -> felt252;
    fn get_proposal_end_time(self: @TContractState, proposal_id: u64) -> u64;
    fn is_proposal_tallied(self: @TContractState, proposal_id: u64) -> bool;
    fn get_proposal_vote_count(self: @TContractState, proposal_id: u64) -> u64;
    fn get_tally_result(self: @TContractState, proposal_id: u64, option: felt252) -> u64;
    fn get_winning_option(self: @TContractState, proposal_id: u64) -> felt252;
    fn is_vote_commitment_used(self: @TContractState, vote_commitment: felt252) -> bool;
    fn is_nullifier_used_for_proposal(
        self: @TContractState, proposal_id: u64, nullifier_hash: felt252,
    ) -> bool;
}

#[starknet::contract]
pub mod PrivateVoting {
    use super::RevealedVote;
    use core::poseidon::PoseidonTrait;
    use core::hash::HashStateTrait;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use lisan_contracts::commitment::{compute_vote_commitment, compute_nullifier_hash};

    #[storage]
    struct Storage {
        proposal_count: u64,
        // Per-proposal storage
        proposal_description: Map<u64, felt252>,
        proposal_num_options: Map<u64, felt252>,
        proposal_end_time: Map<u64, u64>,
        proposal_creator: Map<u64, ContractAddress>,
        proposal_exists: Map<u64, bool>,
        proposal_tallied: Map<u64, bool>,
        proposal_vote_count: Map<u64, u64>,
        proposal_winning_option: Map<u64, felt252>,
        // Vote commitments — globally unique
        vote_commitments: Map<felt252, bool>,
        vote_commitment_proposal: Map<felt252, u64>,
        // Store nullifier_hash per commitment (for tally verification)
        vote_commitment_nullifier: Map<felt252, felt252>,
        // Per-proposal nullifiers: key = Poseidon(proposal_id_felt, nullifier_hash)
        proposal_nullifiers: Map<felt252, bool>,
        // Tally results: key = Poseidon(proposal_id_felt, option) → count
        tally_results: Map<felt252, u64>,
        // Track which commitments have been tallied (prevent double-counting in batch)
        vote_tallied: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ProposalCreated: ProposalCreated,
        VoteCast: VoteCast,
        ProposalTallied: ProposalTallied,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProposalCreated {
        #[key]
        pub proposal_id: u64,
        pub creator: ContractAddress,
        pub description_hash: felt252,
        pub num_options: felt252,
        pub end_time: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VoteCast {
        #[key]
        pub proposal_id: u64,
        pub vote_commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProposalTallied {
        #[key]
        pub proposal_id: u64,
        pub winning_option: felt252,
        pub total_votes_tallied: u64,
    }

    /// Compute composite key for per-proposal nullifier: Poseidon(proposal_id, nullifier_hash)
    fn proposal_nullifier_key(proposal_id: u64, nullifier_hash: felt252) -> felt252 {
        let pid: felt252 = proposal_id.into();
        PoseidonTrait::new().update(pid).update(nullifier_hash).finalize()
    }

    /// Compute composite key for tally result: Poseidon(proposal_id, option)
    fn tally_key(proposal_id: u64, option: felt252) -> felt252 {
        let pid: felt252 = proposal_id.into();
        PoseidonTrait::new().update(pid).update(option).finalize()
    }

    #[abi(embed_v0)]
    impl PrivateVotingImpl of super::IPrivateVoting<ContractState> {
        fn create_proposal(
            ref self: ContractState,
            description_hash: felt252,
            num_options: felt252,
            end_time: u64,
        ) -> u64 {
            // Must have at least 2 options
            assert(num_options != 0 && num_options != 1, 'Need at least 2 options');

            // End time must be in the future
            let current_time = get_block_timestamp();
            assert(end_time > current_time, 'End time must be in future');

            let proposal_id = self.proposal_count.read();
            let caller = get_caller_address();

            self.proposal_description.write(proposal_id, description_hash);
            self.proposal_num_options.write(proposal_id, num_options);
            self.proposal_end_time.write(proposal_id, end_time);
            self.proposal_creator.write(proposal_id, caller);
            self.proposal_exists.write(proposal_id, true);

            self.proposal_count.write(proposal_id + 1);

            self
                .emit(
                    ProposalCreated {
                        proposal_id, creator: caller, description_hash, num_options, end_time,
                    },
                );

            proposal_id
        }

        fn cast_vote(
            ref self: ContractState,
            proposal_id: u64,
            vote_commitment: felt252,
            nullifier_hash: felt252,
        ) {
            // Proposal must exist
            assert(self.proposal_exists.read(proposal_id), 'Proposal does not exist');

            // Must be before end time
            let current_time = get_block_timestamp();
            let end_time = self.proposal_end_time.read(proposal_id);
            assert(current_time < end_time, 'Voting period ended');

            // Proposal must not be tallied
            assert(!self.proposal_tallied.read(proposal_id), 'Already tallied');

            // Vote commitment must be unique (globally)
            assert(!self.vote_commitments.read(vote_commitment), 'Vote commitment exists');

            // Per-proposal nullifier check (prevents double-voting per proposal)
            let nk = proposal_nullifier_key(proposal_id, nullifier_hash);
            assert(!self.proposal_nullifiers.read(nk), 'Already voted on proposal');

            // Store vote
            self.vote_commitments.write(vote_commitment, true);
            self.vote_commitment_proposal.write(vote_commitment, proposal_id);
            self.vote_commitment_nullifier.write(vote_commitment, nullifier_hash);
            self.proposal_nullifiers.write(nk, true);

            // Increment vote count
            let count = self.proposal_vote_count.read(proposal_id);
            self.proposal_vote_count.write(proposal_id, count + 1);

            self.emit(VoteCast { proposal_id, vote_commitment });
        }

        fn tally(
            ref self: ContractState,
            proposal_id: u64,
            revealed_votes: Span<RevealedVote>,
        ) {
            // Proposal must exist
            assert(self.proposal_exists.read(proposal_id), 'Proposal does not exist');

            // Must be past end time
            let current_time = get_block_timestamp();
            let end_time = self.proposal_end_time.read(proposal_id);
            assert(current_time >= end_time, 'Voting not ended yet');

            // Must not be tallied already
            assert(!self.proposal_tallied.read(proposal_id), 'Already tallied');

            let num_options = self.proposal_num_options.read(proposal_id);
            let num_options_u256: u256 = num_options.into();

            // Process each revealed vote
            let mut i: u32 = 0;
            let len = revealed_votes.len();
            loop {
                if i >= len {
                    break;
                }
                let vote = *revealed_votes.at(i);

                // Vote commitment must exist
                assert(
                    self.vote_commitments.read(vote.vote_commitment), 'Vote commitment not found',
                );

                // Vote must belong to this proposal
                assert(
                    self.vote_commitment_proposal.read(vote.vote_commitment) == proposal_id,
                    'Vote not for this proposal',
                );

                // Prevent double-counting within the batch
                assert(!self.vote_tallied.read(vote.vote_commitment), 'Duplicate revealed vote');

                // Verify commitment matches revealed data
                let computed = compute_vote_commitment(
                    vote.choice, vote.secret, vote.nullifier_secret,
                );
                assert(computed == vote.vote_commitment, 'Invalid vote reveal');

                // Verify nullifier_hash matches what was provided during cast_vote
                let stored_nh = self.vote_commitment_nullifier.read(vote.vote_commitment);
                let computed_nh = compute_nullifier_hash(vote.nullifier_secret);
                assert(computed_nh == stored_nh, 'Nullifier mismatch');

                // Verify choice is valid (choice < num_options)
                let choice_u256: u256 = vote.choice.into();
                assert(choice_u256 < num_options_u256, 'Invalid choice');

                // Mark as tallied
                self.vote_tallied.write(vote.vote_commitment, true);

                // Increment tally for this choice
                let tk = tally_key(proposal_id, vote.choice);
                let current_count = self.tally_results.read(tk);
                self.tally_results.write(tk, current_count + 1);

                i += 1;
            };

            // Find winning option (option with most votes; ties go to lowest index)
            let mut winning_option: felt252 = 0;
            let mut max_votes: u64 = 0;
            let mut current_opt: felt252 = 0;
            let mut counted: u256 = 0;
            loop {
                if counted >= num_options_u256 {
                    break;
                }
                let tk = tally_key(proposal_id, current_opt);
                let votes = self.tally_results.read(tk);
                if votes > max_votes {
                    max_votes = votes;
                    winning_option = current_opt;
                }
                current_opt += 1;
                counted += 1;
            };

            self.proposal_tallied.write(proposal_id, true);
            self.proposal_winning_option.write(proposal_id, winning_option);

            let total_tallied: u64 = len.into();
            self
                .emit(
                    ProposalTallied {
                        proposal_id, winning_option, total_votes_tallied: total_tallied,
                    },
                );
        }

        // ---- View functions ----

        fn get_proposal_count(self: @ContractState) -> u64 {
            self.proposal_count.read()
        }

        fn get_proposal_description(self: @ContractState, proposal_id: u64) -> felt252 {
            self.proposal_description.read(proposal_id)
        }

        fn get_proposal_num_options(self: @ContractState, proposal_id: u64) -> felt252 {
            self.proposal_num_options.read(proposal_id)
        }

        fn get_proposal_end_time(self: @ContractState, proposal_id: u64) -> u64 {
            self.proposal_end_time.read(proposal_id)
        }

        fn is_proposal_tallied(self: @ContractState, proposal_id: u64) -> bool {
            self.proposal_tallied.read(proposal_id)
        }

        fn get_proposal_vote_count(self: @ContractState, proposal_id: u64) -> u64 {
            self.proposal_vote_count.read(proposal_id)
        }

        fn get_tally_result(self: @ContractState, proposal_id: u64, option: felt252) -> u64 {
            let tk = tally_key(proposal_id, option);
            self.tally_results.read(tk)
        }

        fn get_winning_option(self: @ContractState, proposal_id: u64) -> felt252 {
            self.proposal_winning_option.read(proposal_id)
        }

        fn is_vote_commitment_used(self: @ContractState, vote_commitment: felt252) -> bool {
            self.vote_commitments.read(vote_commitment)
        }

        fn is_nullifier_used_for_proposal(
            self: @ContractState, proposal_id: u64, nullifier_hash: felt252,
        ) -> bool {
            let nk = proposal_nullifier_key(proposal_id, nullifier_hash);
            self.proposal_nullifiers.read(nk)
        }
    }
}
