/**
 * Client-side Groth16 proof generation using snarkjs + garaga calldata builder.
 *
 * Flow:
 * 1. snarkjs generates the Groth16 proof + public signals
 * 2. garaga npm converts (proof, vk) into `full_proof_with_hints` calldata
 * 3. The calldata is sent to the on-chain Garaga verifier contract
 */
import type { MerklePath } from "./merkle";
import type { PoolNote, AmmNote, BetNote } from "./storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SnarkJS = any;

let snarkjs: SnarkJS | null = null;

async function getSnarkJS(): Promise<SnarkJS> {
  if (snarkjs) return snarkjs;
  snarkjs = await import("snarkjs");
  return snarkjs;
}

// Lazy-load garaga (WASM module needs initialization)
let garagaModule: typeof import("garaga") | null = null;

async function getGaraga() {
  if (garagaModule) return garagaModule;
  const garaga = await import("garaga");
  await garaga.init();
  garagaModule = garaga;
  return garaga;
}

const CIRCUIT_BASE = "/circuits";

// Demo mode: skip garaga calldata generation, just pass public inputs as full_proof_with_hints.
// Works with MockGroth16Verifier contract which reads the first N felts as public inputs.
// Set to false when using real Garaga verifier contracts.
const DEMO_MODE = true;

// Verification key cache
const vkCache = new Map<string, VerifyingKeyJSON>();

interface VerifyingKeyJSON {
  protocol: string;
  curve: string;
  nPublic: number;
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
}

async function loadVerifyingKey(circuitName: string): Promise<VerifyingKeyJSON> {
  const cached = vkCache.get(circuitName);
  if (cached) return cached;

  const resp = await fetch(`${CIRCUIT_BASE}/${circuitName}/${circuitName}_vk.json`);
  const vk: VerifyingKeyJSON = await resp.json();
  vkCache.set(circuitName, vk);
  return vk;
}

interface ProofResult {
  /** full_proof_with_hints calldata for Garaga verifier (as hex strings for felt252) */
  fullProofWithHints: string[];
  /** Raw public signals from snarkjs */
  publicSignals: string[];
}

/**
 * Convert snarkjs verification key JSON to garaga Groth16VerifyingKey format.
 */
function convertVK(vk: VerifyingKeyJSON) {
  return {
    alpha: {
      x: BigInt(vk.vk_alpha_1[0]),
      y: BigInt(vk.vk_alpha_1[1]),
      curveId: 0 as const, // BN254
    },
    beta: {
      x: [BigInt(vk.vk_beta_2[0][0]), BigInt(vk.vk_beta_2[0][1])] as [bigint, bigint],
      y: [BigInt(vk.vk_beta_2[1][0]), BigInt(vk.vk_beta_2[1][1])] as [bigint, bigint],
      curveId: 0 as const,
    },
    gamma: {
      x: [BigInt(vk.vk_gamma_2[0][0]), BigInt(vk.vk_gamma_2[0][1])] as [bigint, bigint],
      y: [BigInt(vk.vk_gamma_2[1][0]), BigInt(vk.vk_gamma_2[1][1])] as [bigint, bigint],
      curveId: 0 as const,
    },
    delta: {
      x: [BigInt(vk.vk_delta_2[0][0]), BigInt(vk.vk_delta_2[0][1])] as [bigint, bigint],
      y: [BigInt(vk.vk_delta_2[1][0]), BigInt(vk.vk_delta_2[1][1])] as [bigint, bigint],
      curveId: 0 as const,
    },
    ic: vk.IC.map((point) => ({
      x: BigInt(point[0]),
      y: BigInt(point[1]),
      curveId: 0 as const,
    })),
  };
}

/**
 * Convert snarkjs proof to garaga Groth16Proof format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertProof(proof: any, publicSignals: string[]) {
  return {
    a: {
      x: BigInt(proof.pi_a[0]),
      y: BigInt(proof.pi_a[1]),
      curveId: 0 as const,
    },
    b: {
      x: [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])] as [bigint, bigint],
      y: [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])] as [bigint, bigint],
      curveId: 0 as const,
    },
    c: {
      x: BigInt(proof.pi_c[0]),
      y: BigInt(proof.pi_c[1]),
      curveId: 0 as const,
    },
    publicInputs: publicSignals.map((s) => BigInt(s)),
  };
}

/**
 * Public signal names for each circuit, in declaration order.
 * Must match the `component main {public [...]}` in each .circom file.
 */
const CIRCUIT_PUBLIC_SIGNALS: Record<string, string[]> = {
  pool_withdraw: ["root", "nullifierHash", "withdrawAmount"],
  pool_transfer: ["root", "nullifierHash", "newCommitmentSender", "newCommitmentRecipient"],
  amm_withdraw: ["root", "nullifierHash", "tokenType", "withdrawAmount"],
  amm_swap: ["root", "nullifierHash", "tokenTypeIn", "amountIn", "tokenTypeOut", "newCommitment", "amountOut"],
  bet_claim: ["betCommitment", "nullifierHash", "winningOutcome"],
};

async function generateProof(
  circuitName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: Record<string, any>
): Promise<ProofResult> {
  if (DEMO_MODE) {
    // Demo mode: skip ZK circuit entirely.
    // MockGroth16Verifier reads the first N felts as public inputs,
    // so we just send the public signals directly.
    const signalNames = CIRCUIT_PUBLIC_SIGNALS[circuitName];
    if (!signalNames) throw new Error(`Unknown circuit: ${circuitName}`);

    const publicSignals = signalNames.map((name) => {
      const val = inputs[name];
      if (val === undefined) throw new Error(`Missing public input: ${name}`);
      return BigInt(val).toString();
    });

    const fullProofWithHints = publicSignals.map((s) => {
      return "0x" + BigInt(s).toString(16);
    });

    return { fullProofWithHints, publicSignals };
  }

  // Production mode: generate real Groth16 proof via snarkjs + garaga
  const sn = await getSnarkJS();

  const wasmPath = `${CIRCUIT_BASE}/${circuitName}/${circuitName}.wasm`;
  const zkeyPath = `${CIRCUIT_BASE}/${circuitName}/${circuitName}_final.zkey`;

  const { proof, publicSignals } = await sn.groth16.fullProve(
    inputs,
    wasmPath,
    zkeyPath
  );

  const garaga = await getGaraga();
  const vkJSON = await loadVerifyingKey(circuitName);
  const garagaProof = convertProof(proof, publicSignals);
  const garagaVK = convertVK(vkJSON);
  const calldata: bigint[] = garaga.getGroth16CallData(
    garagaProof,
    garagaVK,
    garaga.CurveId.BN254
  );

  const fullProofWithHints = calldata.map((v) => "0x" + v.toString(16));
  return { fullProofWithHints, publicSignals };
}

/**
 * Generate a pool withdrawal proof.
 */
export async function generatePoolWithdrawProof(
  note: PoolNote,
  merklePath: MerklePath,
  root: string,
  nullifierHash: string,
): Promise<ProofResult> {
  const inputs = {
    // Public inputs
    root,
    nullifierHash,
    withdrawAmount: note.amount,

    // Private inputs
    amount: note.amount,
    secret: note.secret,
    nullifierSecret: note.nullifierSecret,
    pathElements: merklePath.pathElements.map((e) => e.toString()),
    pathIndices: merklePath.pathIndices,
  };

  return generateProof("pool_withdraw", inputs);
}

/**
 * Generate a pool transfer proof.
 */
export async function generatePoolTransferProof(
  note: PoolNote,
  merklePath: MerklePath,
  root: string,
  nullifierHash: string,
  newCommitmentSender: string,
  newCommitmentRecipient: string,
  changeAmount: string,
  transferAmount: string,
  newSecretSender: string,
  newNullifierSecretSender: string,
  newSecretRecipient: string,
  newNullifierSecretRecipient: string,
): Promise<ProofResult> {
  const inputs = {
    // Public inputs
    root,
    nullifierHash,
    newCommitmentSender,
    newCommitmentRecipient,

    // Private inputs
    oldAmount: note.amount,
    oldSecret: note.secret,
    oldNullifierSecret: note.nullifierSecret,
    changeAmount,
    transferAmount,
    newSecretSender,
    newNullifierSecretSender,
    newSecretRecipient,
    newNullifierSecretRecipient,
    pathElements: merklePath.pathElements.map((e) => e.toString()),
    pathIndices: merklePath.pathIndices,
  };

  return generateProof("pool_transfer", inputs);
}

/**
 * Generate an AMM withdrawal proof.
 */
export async function generateAmmWithdrawProof(
  note: AmmNote,
  merklePath: MerklePath,
  root: string,
  nullifierHash: string,
): Promise<ProofResult> {
  const inputs = {
    // Public inputs
    root,
    nullifierHash,
    tokenType: note.tokenType,
    withdrawAmount: note.amount,

    // Private inputs
    amount: note.amount,
    secret: note.secret,
    nullifierSecret: note.nullifierSecret,
    pathElements: merklePath.pathElements.map((e) => e.toString()),
    pathIndices: merklePath.pathIndices,
  };

  return generateProof("amm_withdraw", inputs);
}

/**
 * Generate an AMM swap proof.
 */
export async function generateAmmSwapProof(
  note: AmmNote,
  merklePath: MerklePath,
  root: string,
  nullifierHash: string,
  newCommitment: string,
  amountOut: string,
  tokenTypeOut: string,
  newSecret: string,
  newNullifierSecret: string,
): Promise<ProofResult> {
  const inputs = {
    // Public inputs
    root,
    nullifierHash,
    tokenTypeIn: note.tokenType,
    amountIn: note.amount,
    tokenTypeOut,
    newCommitment,
    amountOut,

    // Private inputs
    oldSecret: note.secret,
    oldNullifierSecret: note.nullifierSecret,
    newSecret,
    newNullifierSecret,
    pathElements: merklePath.pathElements.map((e) => e.toString()),
    pathIndices: merklePath.pathIndices,
  };

  return generateProof("amm_swap", inputs);
}

/**
 * Generate a bet claim proof (no Merkle tree).
 */
export async function generateBetClaimProof(
  note: BetNote,
  winningOutcome: string,
): Promise<ProofResult> {
  const inputs = {
    outcome: note.outcome,
    amount: note.amount,
    secret: note.secret,
    nullifierSecret: note.nullifierSecret,
    // betCommitment, nullifierHash, winningOutcome are computed by circuit
    winningOutcome,
  };

  return generateProof("bet_claim", inputs);
}
