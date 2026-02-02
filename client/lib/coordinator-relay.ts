import { Contract, RpcProvider, AccountInterface, CallData, type Abi } from "starknet";
import { ADDRESSES } from "@/lib/addresses";

// Minimal ABI for RelayerCoordinator
const COORDINATOR_ABI = [
  {
    type: "function",
    name: "select_relayer",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "submit_transfer_via_relayer",
    inputs: [
      { name: "full_proof_with_hints", type: "core::array::Span::<core::felt252>" },
      { name: "root", type: "core::felt252" },
      { name: "nullifier_hash", type: "core::felt252" },
      { name: "new_commitment_sender", type: "core::felt252" },
      { name: "new_commitment_recipient", type: "core::felt252" },
      { name: "relayer_id", type: "core::integer::u256" },
      { name: "fee_amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "submit_withdraw_via_relayer",
    inputs: [
      { name: "full_proof_with_hints", type: "core::array::Span::<core::felt252>" },
      { name: "root", type: "core::felt252" },
      { name: "nullifier_hash", type: "core::felt252" },
      { name: "token_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "withdraw_amount", type: "core::integer::u256" },
      { name: "relayer_id", type: "core::integer::u256" },
      { name: "fee_amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "submit_execute_via_relayer",
    inputs: [
      { name: "full_proof_with_hints", type: "core::array::Span::<core::felt252>" },
      { name: "root", type: "core::felt252" },
      { name: "nullifier_hash", type: "core::felt252" },
      { name: "token_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
      { name: "target_contract", type: "core::starknet::contract_address::ContractAddress" },
      { name: "call_data", type: "core::array::Span::<core::felt252>" },
      { name: "change_commitment", type: "core::felt252" },
      { name: "change_amount", type: "core::integer::u256" },
      { name: "relayer_id", type: "core::integer::u256" },
      { name: "fee_amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_estimated_fee",
    inputs: [{ name: "tx_amount", type: "core::integer::u256" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_fee_bps",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
];

const REGISTRY_ABI = [
  {
    type: "function",
    name: "get_active_relayer_count",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_relayer_count",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
];

/**
 * Check whether the on-chain relayer network is available
 * (contracts deployed and at least one active relayer)
 */
export async function isCoordinatorAvailable(provider: RpcProvider): Promise<boolean> {
  if (!ADDRESSES.RELAYER_COORDINATOR || !ADDRESSES.RELAYER_REGISTRY) return false;

  try {
    const registry = new Contract({ abi: REGISTRY_ABI as Abi, address: ADDRESSES.RELAYER_REGISTRY, providerOrAccount: provider });
    const activeCount = await registry.get_active_relayer_count();
    return Number(activeCount) > 0;
  } catch {
    return false;
  }
}

/**
 * Get the estimated relayer fee in BPS (basis points)
 */
export async function getFeeBps(provider: RpcProvider): Promise<number> {
  const coordinator = new Contract({ abi: COORDINATOR_ABI as Abi, address: ADDRESSES.RELAYER_COORDINATOR, providerOrAccount: provider });
  const bps = await coordinator.get_fee_bps();
  return Number(bps);
}

/**
 * Calculate the relayer fee for a given amount
 */
export function calculateFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / 10000n;
}

/**
 * Select a relayer via the coordinator's round-robin mechanism.
 * Returns the relayer ID.
 */
export async function selectRelayer(
  account: AccountInterface,
): Promise<bigint> {
  const coordinator = new Contract({ abi: COORDINATOR_ABI as Abi, address: ADDRESSES.RELAYER_COORDINATOR, providerOrAccount: account });
  coordinator.connect(account);
  const result = await coordinator.select_relayer();
  return BigInt(result);
}

/**
 * Submit a shielded transfer via the on-chain coordinator
 */
export async function coordinatorTransfer(
  account: AccountInterface,
  params: {
    fullProofWithHints: string[];
    root: string;
    nullifierHash: string;
    newCommitmentSender: string;
    newCommitmentRecipient: string;
    relayerId: bigint;
    feeAmount: bigint;
  },
): Promise<{ transactionHash: string }> {
  const result = await account.execute([
    {
      contractAddress: ADDRESSES.RELAYER_COORDINATOR,
      entrypoint: "submit_transfer_via_relayer",
      calldata: CallData.compile({
        full_proof_with_hints: params.fullProofWithHints,
        root: params.root,
        nullifier_hash: params.nullifierHash,
        new_commitment_sender: params.newCommitmentSender,
        new_commitment_recipient: params.newCommitmentRecipient,
        relayer_id: { low: params.relayerId.toString(), high: "0" },
        fee_amount: { low: params.feeAmount.toString(), high: "0" },
      }),
    },
  ]);

  return { transactionHash: result.transaction_hash };
}

/**
 * Submit a shielded withdraw via the on-chain coordinator
 */
export async function coordinatorWithdraw(
  account: AccountInterface,
  params: {
    fullProofWithHints: string[];
    root: string;
    nullifierHash: string;
    tokenAddress: string;
    withdrawAmount: bigint;
    relayerId: bigint;
    feeAmount: bigint;
  },
): Promise<{ transactionHash: string }> {
  const result = await account.execute([
    {
      contractAddress: ADDRESSES.RELAYER_COORDINATOR,
      entrypoint: "submit_withdraw_via_relayer",
      calldata: CallData.compile({
        full_proof_with_hints: params.fullProofWithHints,
        root: params.root,
        nullifier_hash: params.nullifierHash,
        token_address: params.tokenAddress,
        withdraw_amount: { low: params.withdrawAmount.toString(), high: "0" },
        relayer_id: { low: params.relayerId.toString(), high: "0" },
        fee_amount: { low: params.feeAmount.toString(), high: "0" },
      }),
    },
  ]);

  return { transactionHash: result.transaction_hash };
}

/**
 * Submit a private execute via the on-chain coordinator
 */
export async function coordinatorExecute(
  account: AccountInterface,
  params: {
    fullProofWithHints: string[];
    root: string;
    nullifierHash: string;
    tokenAddress: string;
    amount: bigint;
    targetContract: string;
    callData: string[];
    changeCommitment: string;
    changeAmount: bigint;
    relayerId: bigint;
    feeAmount: bigint;
  },
): Promise<{ transactionHash: string }> {
  const result = await account.execute([
    {
      contractAddress: ADDRESSES.RELAYER_COORDINATOR,
      entrypoint: "submit_execute_via_relayer",
      calldata: CallData.compile({
        full_proof_with_hints: params.fullProofWithHints,
        root: params.root,
        nullifier_hash: params.nullifierHash,
        token_address: params.tokenAddress,
        amount: { low: params.amount.toString(), high: "0" },
        target_contract: params.targetContract,
        call_data: params.callData,
        change_commitment: params.changeCommitment,
        change_amount: { low: params.changeAmount.toString(), high: "0" },
        relayer_id: { low: params.relayerId.toString(), high: "0" },
        fee_amount: { low: params.feeAmount.toString(), high: "0" },
      }),
    },
  ]);

  return { transactionHash: result.transaction_hash };
}
