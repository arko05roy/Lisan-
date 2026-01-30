import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, hash } from "starknet";

const RPC_URL = process.env.STARKNET_RPC_URL!;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL!;
const AMM_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_AMM!;

/**
 * GET /api/events?contract=pool|amm
 *
 * Fetches all Deposit events from the specified shielded contract.
 * Runs server-side to avoid browser CORS restrictions on the RPC endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const contractType = req.nextUrl.searchParams.get("contract");
    if (contractType !== "pool" && contractType !== "amm") {
      return NextResponse.json(
        { error: "contract must be 'pool' or 'amm'" },
        { status: 400 },
      );
    }

    const contractAddress = contractType === "pool" ? POOL_ADDRESS : AMM_ADDRESS;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const depositSelector = hash.getSelectorFromName("Deposit");

    const deposits: Array<{ commitment: string; leafIndex: number }> = [];
    let continuationToken: string | undefined;

    do {
      const result = await provider.getEvents({
        address: contractAddress,
        keys: [[depositSelector]],
        from_block: { block_number: 0 },
        to_block: "pending",
        chunk_size: 1000,
        ...(continuationToken
          ? { continuation_token: continuationToken }
          : {}),
      });

      for (const event of result.events) {
        const data = event.data;
        if (contractType === "pool") {
          // Pool Deposit data: [amount_low, amount_high, commitment, leaf_index]
          deposits.push({ commitment: data[2], leafIndex: Number(data[3]) });
        } else {
          // AMM Deposit data: [token_type, amount_low, amount_high, commitment, leaf_index]
          deposits.push({ commitment: data[3], leafIndex: Number(data[4]) });
        }
      }

      continuationToken = result.continuation_token;
    } while (continuationToken);

    return NextResponse.json({ deposits });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
