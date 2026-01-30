import { Call, uint256 } from "starknet";

export function buildApproveCall(
  tokenAddress: string,
  spender: string,
  amount: bigint,
): Call {
  const u = uint256.bnToUint256(amount);
  return {
    contractAddress: tokenAddress,
    entrypoint: "approve",
    calldata: [spender, u.low.toString(), u.high.toString()],
  };
}

export function buildCall(
  contractAddress: string,
  entrypoint: string,
  calldata: string[],
): Call {
  return { contractAddress, entrypoint, calldata };
}
