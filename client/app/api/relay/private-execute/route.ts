import { NextRequest, NextResponse } from "next/server";
import { Account, RpcProvider, uint256 } from "starknet";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS!;
const RPC_URL = process.env.STARKNET_RPC_URL!;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullProofWithHints,
      root,
      nullifierHash,
      tokenAddress,
      amount,
      targetContract,
      callData,
      changeCommitment,
      changeAmount,
    } = body;

    if (
      !fullProofWithHints ||
      !root ||
      !nullifierHash ||
      !tokenAddress ||
      !amount ||
      !targetContract
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    if (!Array.isArray(fullProofWithHints)) {
      return NextResponse.json(
        { error: "fullProofWithHints must be an array" },
        { status: 400 },
      );
    }

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({
      provider,
      address: RELAYER_ADDRESS,
      signer: RELAYER_PRIVATE_KEY,
    });

    const uAmount = uint256.bnToUint256(BigInt(amount));
    const uChangeAmount = uint256.bnToUint256(BigInt(changeAmount || "0"));

    // Build calldata for private_execute
    const proofSpan = [
      fullProofWithHints.length.toString(),
      ...fullProofWithHints,
    ];
    const callDataSpan = Array.isArray(callData)
      ? [callData.length.toString(), ...callData]
      : ["0"];

    const calldata = [
      ...proofSpan,
      root,
      nullifierHash,
      tokenAddress,
      uAmount.low.toString(),
      uAmount.high.toString(),
      targetContract,
      ...callDataSpan,
      changeCommitment || "0",
      uChangeAmount.low.toString(),
      uChangeAmount.high.toString(),
    ];

    const result = await account.execute([
      {
        contractAddress: POOL_ADDRESS,
        entrypoint: "private_execute",
        calldata,
      },
    ]);

    return NextResponse.json({ transactionHash: result.transaction_hash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
