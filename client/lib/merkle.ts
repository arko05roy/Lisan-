/**
 * Client-side Merkle tree that mirrors the on-chain incremental Poseidon Merkle tree.
 *
 * Uses circomlibjs Poseidon (BN254 field) to match the ZK circuits.
 * Reconstructs the tree from on-chain Deposit events.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidonInstance: any = null;

async function getPoseidon() {
  if (poseidonInstance) return poseidonInstance;
  // Dynamic import — circomlibjs uses WASM
  const circomlibjs = await import("circomlibjs");
  poseidonInstance = await circomlibjs.buildPoseidon();
  return poseidonInstance;
}

/**
 * Compute BN254 Poseidon hash (matches circomlib).
 * Returns a BigInt.
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const hash = poseidon(inputs.map((x) => x));
  return poseidon.F.toObject(hash);
}

/**
 * Compute Poseidon hash of two elements (for Merkle tree nodes).
 */
export async function poseidonHash2(left: bigint, right: bigint): Promise<bigint> {
  return poseidonHash([left, right]);
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
 * Incremental Merkle tree (BN254 Poseidon) — mirrors the on-chain component.
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
      currentZero = await poseidonHash2(currentZero, currentZero);
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
        currentLevelHash = await poseidonHash2(currentLevelHash, this._zeros[i]);
      } else {
        currentLevelHash = await poseidonHash2(this._filledSubtrees[i], currentLevelHash);
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
   * Get the Merkle path (proof) for a leaf at the given index.
   * This recomputes the path from scratch using all inserted leaves.
   */
  async getPath(leafIndex: number): Promise<MerklePath> {
    if (!this._initialized) throw new Error("Tree not initialized");
    if (leafIndex >= this._nextIndex) throw new Error("Leaf index out of range");

    // Build full tree layer by layer
    const layers: bigint[][] = [];

    // Layer 0: all leaves, padded with zeros
    const totalLeaves = 2 ** this.levels;
    const layer0: bigint[] = new Array(totalLeaves);
    for (let i = 0; i < totalLeaves; i++) {
      layer0[i] = i < this._leaves.length ? this._leaves[i] : this._zeros[0];
    }
    layers.push(layer0);

    // Build parent layers
    for (let level = 1; level <= this.levels; level++) {
      const prevLayer = layers[level - 1];
      const layerSize = prevLayer.length / 2;
      const layer: bigint[] = new Array(layerSize);
      for (let j = 0; j < layerSize; j++) {
        layer[j] = await poseidonHash2(prevLayer[2 * j], prevLayer[2 * j + 1]);
      }
      layers.push(layer);
    }

    // Extract path
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];

    let idx = leafIndex;
    for (let level = 0; level < this.levels; level++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      pathElements.push(layers[level][siblingIdx]);
      pathIndices.push(idx % 2);
      idx = Math.floor(idx / 2);
    }

    return { pathElements, pathIndices };
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
 */
export async function buildTreeFromEvents(
  events: Array<{ commitment: string; leafIndex: number }>
): Promise<MerkleTree> {
  const tree = new MerkleTree(TREE_LEVELS);
  await tree.initialize();

  // Sort by leafIndex to ensure correct insertion order
  const sorted = [...events].sort((a, b) => a.leafIndex - b.leafIndex);

  for (const event of sorted) {
    await tree.insert(BigInt(event.commitment));
  }

  return tree;
}
