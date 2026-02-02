/**
 * Client-side Merkle tree that mirrors the on-chain incremental Poseidon Merkle tree.
 *
 * Uses Stark-field Poseidon (matching Cairo's PoseidonTrait) for hashing.
 * Reconstructs the tree from on-chain Deposit events.
 */

import { ec } from "starknet";

const { poseidonHashMany } = ec.starkCurve;

/**
 * Compute Stark-field Poseidon hash.
 * Matches Cairo's PoseidonTrait::new().update(...).finalize().
 * Returns a BigInt.
 */
export function poseidonHash(inputs: bigint[]): bigint {
  return poseidonHashMany(inputs);
}

/**
 * Compute Poseidon hash of two elements (for Merkle tree nodes).
 */
export function poseidonHash2(left: bigint, right: bigint): bigint {
  return poseidonHashMany([left, right]);
}

const TREE_LEVELS = 20;
const ROOT_HISTORY_SIZE = 30;

// Must match the on-chain ZERO_VALUE constant in bn254_poseidon.cairo
const ZERO_VALUE = BigInt(
  "149573504042682935034498956990981497856992830401657690228951078079877741476"
);

export interface MerklePath {
  pathElements: bigint[];
  pathIndices: number[];
}

/**
 * Incremental Merkle tree (Stark Poseidon) — mirrors the on-chain component.
 */
export class MerkleTree {
  levels: number;
  private _zeros: bigint[] = [];
  private _filledSubtrees: bigint[] = [];
  private _leaves: bigint[] = [];
  private _root: bigint = 0n;
  private _nextIndex: number = 0;
  private _initialized: boolean = false;

  constructor(levels: number = TREE_LEVELS) {
    this.levels = levels;
  }

  /**
   * Initialize the tree by precomputing zero hashes.
   * Must be called before insert() or getRoot().
   */
  async initialize(): Promise<void> {
    this._zeros = new Array(this.levels + 1);
    this._filledSubtrees = new Array(this.levels + 1);

    this._zeros[0] = ZERO_VALUE;
    this._filledSubtrees[0] = ZERO_VALUE;

    let currentZero = ZERO_VALUE;
    for (let i = 1; i <= this.levels; i++) {
      currentZero = poseidonHash2(currentZero, currentZero);
      this._zeros[i] = currentZero;
      this._filledSubtrees[i] = currentZero;
    }

    this._root = currentZero;
    this._initialized = true;
  }

  /**
   * Insert a leaf into the tree. Returns the leaf index.
   * Mirrors the on-chain insert() function exactly.
   */
  async insert(leaf: bigint): Promise<number> {
    if (!this._initialized) throw new Error("Tree not initialized");
    if (this._nextIndex >= 2 ** this.levels) throw new Error("Tree is full");

    const leafIndex = this._nextIndex;
    this._leaves.push(leaf);

    let currentIndex = leafIndex;
    let currentLevelHash = leaf;

    for (let i = 0; i < this.levels; i++) {
      if (currentIndex % 2 === 0) {
        this._filledSubtrees[i] = currentLevelHash;
        currentLevelHash = poseidonHash2(currentLevelHash, this._zeros[i]);
      } else {
        currentLevelHash = poseidonHash2(this._filledSubtrees[i], currentLevelHash);
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    this._root = currentLevelHash;
    this._nextIndex++;

    return leafIndex;
  }

  /**
   * Get the current Merkle root.
   */
  getRoot(): bigint {
    return this._root;
  }

  /**
   * Get the next available leaf index (total number of leaves inserted).
   */
  getNextIndex(): number {
    return this._nextIndex;
  }

  /**
   * Get the Merkle path (proof) for a leaf at the given index.
   * optimized to use sparse tree traversal (skipping empty subtrees).
   */
  async getPath(leafIndex: number): Promise<MerklePath> {
    if (!this._initialized) throw new Error("Tree not initialized");
    if (leafIndex >= this._nextIndex) throw new Error("Leaf index out of range");

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];

    let currentIndex = leafIndex;
    for (let level = 0; level < this.levels; level++) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

      // Calculate sibling value efficiently
      const siblingValue = this._getNode(level, siblingIndex);

      pathElements.push(siblingValue);
      pathIndices.push(currentIndex % 2);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return { pathElements, pathIndices };
  }

  /**
   * Recursive helper to get node value at (level, index).
   * Returns precomputed zero hash if subtree is empty.
   */
  private _getNode(level: number, index: number): bigint {
    // Base case: leaf level
    if (level === 0) {
      if (index < this._leaves.length) {
        return this._leaves[index];
      }
      return this._zeros[0];
    }

    // Optimization: if the start leaf index for this subtree is beyond the inserted leaves,
    // then the entire subtree is empty.
    // The subtree at (level, index) covers leaves starting at index * 2^level
    const startLeafIndex = index * (1 << level);
    if (startLeafIndex >= this._leaves.length) {
      return this._zeros[level];
    }

    // Recursive step
    const leftChild = this._getNode(level - 1, index * 2);
    const rightChild = this._getNode(level - 1, index * 2 + 1);

    return poseidonHash2(leftChild, rightChild);
  }

  /**
   * Number of leaves inserted so far.
   */
  get leafCount(): number {
    return this._nextIndex;
  }
}

/**
 * Build a Merkle tree from deposit events.
 * Events must be sorted by leaf_index.
 * Returns the tree and a mapping from commitment to actual tree index.
 */
export async function buildTreeFromEvents(
  events: Array<{ commitment: string; leafIndex: number }>
): Promise<{ tree: MerkleTree; commitmentToLeafIndex: Map<string, number> }> {
  const tree = new MerkleTree(TREE_LEVELS);
  await tree.initialize();

  // Sort by leafIndex to ensure correct insertion order
  const sorted = [...events].sort((a, b) => a.leafIndex - b.leafIndex);

  const commitmentToLeafIndex = new Map<string, number>();

  // Debug: Check if on-chain indices match expected tree indices
  const onChainIndices = sorted.map(e => e.leafIndex);
  const firstIndex = sorted.length > 0 ? sorted[0].leafIndex : 0;
  const isSequential = onChainIndices.every((idx, i) => idx === i + firstIndex);

  console.log("[Tree Build Debug]", {
    eventCount: sorted.length,
    onChainIndices: onChainIndices.slice(0, 10), // First 10 indices
    firstIndex,
    isZeroBased: firstIndex === 0,
    isSequential,
  });

  if (!isSequential) {
    // Handle gaps by inserting zero leaves at missing indices
    console.warn("[Tree Build] Non-sequential indices detected, inserting zero leaves for gaps");

    const maxIndex = sorted[sorted.length - 1].leafIndex;
    let eventIdx = 0;

    for (let i = 0; i <= maxIndex; i++) {
      if (eventIdx < sorted.length && sorted[eventIdx].leafIndex === i) {
        // Insert actual commitment
        const actualIndex = await tree.insert(BigInt(sorted[eventIdx].commitment));
        commitmentToLeafIndex.set(normalizeHex(sorted[eventIdx].commitment), actualIndex);
        eventIdx++;
      } else {
        // Insert zero leaf for gap
        console.warn(`[Tree Build] Inserting ZERO leaf at index ${i} (gap detected)`);
        await tree.insert(ZERO_VALUE);
      }
    }
  } else {
    // Sequential indices - normal insertion
    for (const event of sorted) {
      const actualIndex = await tree.insert(BigInt(event.commitment));
      commitmentToLeafIndex.set(normalizeHex(event.commitment), actualIndex);
    }
  }

  console.log("[Tree Build Success]", {
    totalLeaves: tree.getNextIndex(),
    root: tree.getRoot().toString(),
    sampleMappings: Array.from(commitmentToLeafIndex.entries()).slice(0, 3),
  });

  return { tree, commitmentToLeafIndex };
}

/**
 * Normalize a hex commitment string so comparisons are safe.
 * Strips leading zeros after 0x prefix.
 */
export function normalizeHex(hex: string): string {
  return "0x" + BigInt(hex).toString(16);
}

/**
 * Fetch all Deposit events from a shielded contract and build the full
 * incremental Merkle tree. Uses the /api/events server-side endpoint to
 * avoid browser CORS restrictions on the RPC node.
 *
 * @param _contractAddress  Unused (resolved server-side from env vars).
 * @param contractType      "pool" or "amm" — determines which contract to query.
 */
export async function buildTreeFromChain(
  _contractAddress: string,
  contractType: "pool" | "amm",
): Promise<{ tree: MerkleTree; commitmentToLeafIndex: Map<string, number> }> {
  const resp = await fetch(`/api/events?contract=${contractType}`);
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch deposit events (${resp.status})`);
  }

  const { deposits } = (await resp.json()) as {
    deposits: Array<{ commitment: string; leafIndex: number }>;
  };

  // buildTreeFromEvents now returns both tree and mapping with correct indices
  return await buildTreeFromEvents(deposits);
}
