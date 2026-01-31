import { NextRequest, NextResponse } from "next/server";
import { Account, RpcProvider, uint256 } from "starknet";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS!;
const RPC_URL = process.env.STARKNET_RPC_URL!;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL!;
const AMM_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_AMM!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      contract,
      fullProofWithHints,
      root,
      nullifierHash,
      withdrawAmount,
      tokenType,
      tokenAddress,
    } = body;

    if (!contract || !fullProofWithHints || !root || !nullifierHash || !withdrawAmount) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (contract !== "pool" && contract !== "amm") {
      return NextResponse.json({ error: "contract must be 'pool' or 'amm'" }, { status: 400 });
    }

    if (contract === "amm" && !tokenType) {
      return NextResponse.json({ error: "tokenType required for AMM withdrawals" }, { status: 400 });
    }

    if (contract === "pool" && !tokenAddress) {
      return NextResponse.json({ error: "tokenAddress required for pool withdrawals" }, { status: 400 });
    }

    if (!Array.isArray(fullProofWithHints)) {
      return NextResponse.json({ error: "fullProofWithHints must be an array" }, { status: 400 });
    }

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({ provider, address: RELAYER_ADDRESS, signer: RELAYER_PRIVATE_KEY });

    const contractAddress = contract === "pool" ? POOL_ADDRESS : AMM_ADDRESS;
    const u = uint256.bnToUint256(BigInt(withdrawAmount));

    // Build calldata: Span<felt252> full_proof_with_hints + root + nullifier_hash + ...
    const proofSpan = [fullProofWithHints.length.toString(), ...fullProofWithHints];

    const calldata = contract === "pool"
      ? [
          ...proofSpan,
          root,
          nullifierHash,
          tokenAddress,
          u.low.toString(), u.high.toString(),
        ]
      : [
          ...proofSpan,
          root,
          nullifierHash,
          tokenType,
          u.low.toString(), u.high.toString(),
        ];

    const result = await account.execute([{
      contractAddress,
      entrypoint: "prepare_withdraw",
      calldata,
    }]);

    return NextResponse.json({ transactionHash: result.transaction_hash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
