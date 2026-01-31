import { NextRequest, NextResponse } from "next/server";
import { Account, RpcProvider } from "starknet";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS!;
const RPC_URL = process.env.STARKNET_RPC_URL!;
const PREDICTION_MARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      marketId,
      fullProofWithHints,
      betCommitment,
      nullifierHash,
      recipient,
    } = body;

    if (!marketId || !fullProofWithHints || !betCommitment || !nullifierHash || !recipient) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (!Array.isArray(fullProofWithHints)) {
      return NextResponse.json({ error: "fullProofWithHints must be an array" }, { status: 400 });
    }

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({ provider, address: RELAYER_ADDRESS, signer: RELAYER_PRIVATE_KEY });

    const proofSpan = [fullProofWithHints.length.toString(), ...fullProofWithHints];
    const calldata = [
      marketId,
      ...proofSpan,
      betCommitment,
      nullifierHash,
      recipient,
    ];

    const result = await account.execute([{
      contractAddress: PREDICTION_MARKET_ADDRESS,
      entrypoint: "claim",
      calldata,
    }]);

    return NextResponse.json({ transactionHash: result.transaction_hash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
