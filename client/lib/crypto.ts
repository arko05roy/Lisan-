import { ec } from "starknet";

const { poseidonHashMany } = ec.starkCurve;

/**
 * Compute Stark-field Poseidon hash of elements.
 * Matches Cairo's PoseidonTrait::new().update(...).finalize().
 * Returns a hex string (0x...).
 */
function poseidonHash(inputs: (string | number | bigint)[]): string {
  const biInputs = inputs.map((x) => BigInt(x));
  const hash = poseidonHashMany(biInputs);
  return "0x" + hash.toString(16);
}

/**
 * Generate a random secret (31 bytes as hex string).
 * Returns a felt252-compatible value.
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Pool commitment = Poseidon(amount, secret, nullifier_secret)
 */
export async function computeCommitment(amount: string, secret: string, nullifierSecret: string): Promise<string> {
  return poseidonHash([amount, secret, nullifierSecret]);
}

/**
 * Nullifier hash = Poseidon(nullifier_secret)
 */
export async function computeNullifierHash(nullifierSecret: string): Promise<string> {
  return poseidonHash([nullifierSecret]);
}

/**
 * AMM commitment = Poseidon(amount, token_type, secret, nullifier_secret)
 */
export async function computeAmmCommitment(
  amount: string,
  tokenType: string,
  secret: string,
  nullifierSecret: string,
): Promise<string> {
  return poseidonHash([amount, tokenType, secret, nullifierSecret]);
}

/**
 * Bet commitment = Poseidon(outcome, amount, secret, nullifier_secret)
 */
export async function computeBetCommitment(
  outcome: string,
  amount: string,
  secret: string,
  nullifierSecret: string,
): Promise<string> {
  return poseidonHash([outcome, amount, secret, nullifierSecret]);
}

/**
 * Vote commitment = Poseidon(choice, secret, nullifier_secret)
 */
export async function computeVoteCommitment(
  choice: string,
  secret: string,
  nullifierSecret: string,
): Promise<string> {
  return poseidonHash([choice, secret, nullifierSecret]);
}
