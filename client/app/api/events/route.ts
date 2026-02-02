import { NextRequest, NextResponse } from "next/server";
import { RpcProvider, hash } from "starknet";

const RPC_URL = process.env.STARKNET_RPC_URL!;
const POOL_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_POOL!;
const AMM_ADDRESS = process.env.NEXT_PUBLIC_SHIELDED_AMM!;

/**
 * GET /api/events?contract=pool|amm
 *
 * Fetches ALL events that insert leaves into the Merkle tree:
 *   Pool: Deposit (1 leaf) + Transfer (2 leaves) + PrivateExecute (0 or 1 leaf)
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

    // --- Fetch PrivateExecute events (pool only) ---
    // private_execute inserts a change_commitment leaf into the tree when change_amount > 0,
    // but the PrivateExecute event doesn't emit the commitment or leaf_index.
    // We extract the change_commitment from the transaction calldata.
    if (contractType === "pool") {
      const privateExecSelector = hash.getSelectorFromName("PrivateExecute");
      continuationToken = undefined;

      // Collect PrivateExecute events that inserted a leaf (change_amount > 0)
      const privateExecLeaves: Array<{ commitment: string; blockNumber: number }> = [];

      do {
        const result = await provider.getEvents({
          address: contractAddress,
          keys: [[privateExecSelector]],
          from_block: { block_number: 0 },
          to_block: "pending",
          chunk_size: 1000,
          ...(continuationToken
            ? { continuation_token: continuationToken }
            : {}),
        });

        for (const event of result.events) {
          // PrivateExecute data: [nullifier_hash, target_contract, amount_low, amount_high, change_amount_low, change_amount_high]
          const data = event.data;
          const changeAmountLow = BigInt(data[4]);
          const changeAmountHigh = BigInt(data[5]);
          const changeAmount = changeAmountLow + (changeAmountHigh << 128n);

          if (changeAmount > 0n) {
            // Extract change_commitment from the transaction calldata.
            // For a single-call invoke tx, the last 3 elements are:
            // [change_commitment, change_amount_low, change_amount_high]
            const tx = await provider.getTransaction(event.transaction_hash) as any;
            const calldata: string[] = tx.calldata || [];
            const changeCommitment = calldata[calldata.length - 3];

            if (changeCommitment) {
              privateExecLeaves.push({
                commitment: changeCommitment,
                blockNumber: event.block_number,
              });
            }
          }
        }

        continuationToken = result.continuation_token;
      } while (continuationToken);

      // Determine leaf indices for PrivateExecute leaves by finding gaps
      // in the known Deposit/Transfer leaf indices.
      if (privateExecLeaves.length > 0) {
        const knownIndices = new Set(deposits.map((d) => d.leafIndex));
        const maxIndex = deposits.length > 0
          ? Math.max(...deposits.map((d) => d.leafIndex))
          : -1;

        const gaps: number[] = [];
        for (let i = 0; i <= maxIndex + privateExecLeaves.length; i++) {
          if (!knownIndices.has(i)) gaps.push(i);
        }

        // Sort PrivateExecute events by block number and match to gaps in order
        privateExecLeaves.sort((a, b) => a.blockNumber - b.blockNumber);

        for (let i = 0; i < privateExecLeaves.length && i < gaps.length; i++) {
          deposits.push({
            commitment: privateExecLeaves[i].commitment,
            leafIndex: gaps[i],
          });
        }
      }
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
