export const PRIVATE_VOTING_ABI = [
  {
    type: "impl",
    name: "PrivateVotingImpl",
    interface_name: "lisan_contracts::private_voting::IPrivateVoting",
  },
  {
    type: "struct",
    name: "lisan_contracts::private_voting::RevealedVote",
    members: [
      {
        name: "vote_commitment",
        type: "core::felt252",
      },
      {
        name: "choice",
        type: "core::felt252",
      },
      {
        name: "secret",
        type: "core::felt252",
      },
      {
        name: "nullifier_secret",
        type: "core::felt252",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<lisan_contracts::private_voting::RevealedVote>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<lisan_contracts::private_voting::RevealedVote>",
      },
    ],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      {
        name: "False",
        type: "()",
      },
      {
        name: "True",
        type: "()",
      },
    ],
  },
  {
    type: "interface",
    name: "lisan_contracts::private_voting::IPrivateVoting",
    items: [
      {
        type: "function",
        name: "create_proposal",
        inputs: [
          {
            name: "description_hash",
            type: "core::felt252",
          },
          {
            name: "num_options",
            type: "core::felt252",
          },
          {
            name: "end_time",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "cast_vote",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
          {
            name: "vote_commitment",
            type: "core::felt252",
          },
          {
            name: "nullifier_hash",
            type: "core::felt252",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "tally",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
          {
            name: "revealed_votes",
            type: "core::array::Span::<lisan_contracts::private_voting::RevealedVote>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_proposal_count",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_proposal_description",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_proposal_num_options",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_proposal_end_time",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_proposal_tallied",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_proposal_vote_count",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_tally_result",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
          {
            name: "option",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_winning_option",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_vote_commitment_used",
        inputs: [
          {
            name: "vote_commitment",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_nullifier_used_for_proposal",
        inputs: [
          {
            name: "proposal_id",
            type: "core::integer::u64",
          },
          {
            name: "nullifier_hash",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "event",
    name: "lisan_contracts::private_voting::PrivateVoting::ProposalCreated",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u64",
        kind: "key",
      },
      {
        name: "creator",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "description_hash",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "num_options",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "end_time",
        type: "core::integer::u64",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "lisan_contracts::private_voting::PrivateVoting::VoteCast",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u64",
        kind: "key",
      },
      {
        name: "vote_commitment",
        type: "core::felt252",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "lisan_contracts::private_voting::PrivateVoting::ProposalTallied",
    kind: "struct",
    members: [
      {
        name: "proposal_id",
        type: "core::integer::u64",
        kind: "key",
      },
      {
        name: "winning_option",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "total_votes_tallied",
        type: "core::integer::u64",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "lisan_contracts::private_voting::PrivateVoting::Event",
    kind: "enum",
    variants: [
      {
        name: "ProposalCreated",
        type: "lisan_contracts::private_voting::PrivateVoting::ProposalCreated",
        kind: "nested",
      },
      {
        name: "VoteCast",
        type: "lisan_contracts::private_voting::PrivateVoting::VoteCast",
        kind: "nested",
      },
      {
        name: "ProposalTallied",
        type: "lisan_contracts::private_voting::PrivateVoting::ProposalTallied",
        kind: "nested",
      },
    ],
  },
] as const;
