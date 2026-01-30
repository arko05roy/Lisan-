import { NextRequest, NextResponse } from "next/server";
import { Account, RpcProvider } from "starknet";

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS!;
const RPC_URL = process.env.STARKNET_RPC_URL!;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL!;
const AMM_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_AMM!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contract, nullifierHash, recipient } = body;

    if (!contract || !nullifierHash || !recipient) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (contract !== "pool" && contract !== "amm") {
      return NextResponse.json({ error: "contract must be 'pool' or 'amm'" }, { status: 400 });
    }

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({ provider, address: RELAYER_ADDRESS, signer: RELAYER_PRIVATE_KEY });

    const contractAddress = contract === "pool" ? POOL_ADDRESS : AMM_ADDRESS;

    const result = await account.execute([{
      contractAddress,
      entrypoint: "claim_withdrawal",
      calldata: [nullifierHash, recipient],
    }]);

    return NextResponse.json({ transactionHash: result.transaction_hash });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
