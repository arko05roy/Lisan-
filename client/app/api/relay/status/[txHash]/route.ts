import { NextRequest, NextResponse } from "next/server";
import { RpcProvider } from "starknet";

const RPC_URL = process.env.STARKNET_RPC_URL!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txHash: string }> },
) {
  try {
    const { txHash } = await params;

    if (!txHash) {
      return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
    }

    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const receipt = await provider.getTransactionReceipt(txHash);

    let status: string = "PENDING";
    if ("execution_status" in receipt) {
      if (receipt.execution_status === "REVERTED") {
        status = "REJECTED";
      } else if (receipt.execution_status === "SUCCEEDED") {
        status = "ACCEPTED_ON_L2";
      }
    }

    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ status: "PENDING" });
  }
}
