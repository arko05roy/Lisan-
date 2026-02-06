export const MOCK_PRAGMA_ORACLE_ABI = [
  {
    type: "function",
    name: "set_result",
    inputs: [
      { name: "market_id", type: "core::integer::u64" },
      { name: "winning_outcome", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_result",
    inputs: [{ name: "market_id", type: "core::integer::u64" }],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "has_result",
    inputs: [{ name: "market_id", type: "core::integer::u64" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
] as const;
