import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, hash } from "starknet";

const RPC_URL = process.env.STARKNET_RPC_URL!;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL!;
const AMM_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_AMM!;

/**
 * GET /api/events?contract=pool|amm
 *
 * Fetches ALL events that insert leaves into the Merkle tree:
 *   Pool: Deposit (1 leaf) + Transfer (2 leaves)
 *   AMM:  Deposit (1 leaf) + Swap (1 leaf)
 *
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

    const deposits: Array<{ commitment: string; leafIndex: number }> = [];

    // --- Fetch Deposit events ---
    const depositSelector = hash.getSelectorFromName("Deposit");
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

    // --- Fetch Transfer events (pool only) ---
    if (contractType === "pool") {
      const transferSelector = hash.getSelectorFromName("Transfer");
      continuationToken = undefined;

      do {
        const result = await provider.getEvents({
          address: contractAddress,
          keys: [[transferSelector]],
          from_block: { block_number: 0 },
          to_block: "pending",
          chunk_size: 1000,
          ...(continuationToken
            ? { continuation_token: continuationToken }
            : {}),
        });

        for (const event of result.events) {
          // Transfer data: [nullifier_hash, new_commitment_sender, new_commitment_recipient, leaf_index_sender, leaf_index_recipient]
          const data = event.data;
          deposits.push({ commitment: data[1], leafIndex: Number(data[3]) }); // sender commitment
          deposits.push({ commitment: data[2], leafIndex: Number(data[4]) }); // recipient commitment
        }

        continuationToken = result.continuation_token;
      } while (continuationToken);
    }

    // --- Fetch Swap events (AMM only) ---
    if (contractType === "amm") {
      const swapSelector = hash.getSelectorFromName("Swap");
      continuationToken = undefined;

      do {
        const result = await provider.getEvents({
          address: contractAddress,
          keys: [[swapSelector]],
          from_block: { block_number: 0 },
          to_block: "pending",
          chunk_size: 1000,
          ...(continuationToken
            ? { continuation_token: continuationToken }
            : {}),
        });

        for (const event of result.events) {
          // AMM Swap data: [nullifier_hash, token_type_in, token_type_out, new_commitment, leaf_index]
          const data = event.data;
          deposits.push({ commitment: data[3], leafIndex: Number(data[4]) });
        }

        continuationToken = result.continuation_token;
      } while (continuationToken);
    }

    return NextResponse.json({ deposits });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
