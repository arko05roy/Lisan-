import { NextRequest, NextResponse } from "next/server";
import { Account, RpcProvider } from "starknet";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS!;
const RPC_URL = process.env.STARKNET_RPC_URL!;
const AMM_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_AMM!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullProofWithHints,
      root,
      nullifierHash,
      tokenTypeIn,
      amountIn,
      tokenTypeOut,
      newCommitment,
      amountOut,
    } = body;

    if (!fullProofWithHints || !root || !nullifierHash || !tokenTypeIn || !amountIn || !tokenTypeOut || !newCommitment || !amountOut) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!Array.isArray(fullProofWithHints)) {
      return NextResponse.json({ error: "fullProofWithHints must be an array" }, { status: 400 });
    }

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({ provider, address: RELAYER_ADDRESS, signer: RELAYER_PRIVATE_KEY });

    const proofSpan = [fullProofWithHints.length.toString(), ...fullProofWithHints];
    const calldata = [
      ...proofSpan,
      root,
      nullifierHash,
      tokenTypeIn,
      amountIn,
      tokenTypeOut,
      newCommitment,
      amountOut,
    ];

    const result = await account.execute([{
      contractAddress: AMM_ADDRESS,
      entrypoint: "swap",
      calldata,
    }]);

    return NextResponse.json({ transactionHash: result.transaction_hash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
