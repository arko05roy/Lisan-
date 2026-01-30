import { hash } from "starknet";

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
export function computeCommitment(amount: string, secret: string, nullifierSecret: string): string {
  return hash.computePoseidonHashOnElements([amount, secret, nullifierSecret]);
}

/**
 * Nullifier hash = Poseidon(nullifier_secret)
 */
export function computeNullifierHash(nullifierSecret: string): string {
  return hash.computePoseidonHashOnElements([nullifierSecret]);
}

/**
 * AMM commitment = Poseidon(amount, token_type, secret, nullifier_secret)
 */
export function computeAmmCommitment(
  amount: string,
  tokenType: string,
  secret: string,
  nullifierSecret: string,
): string {
  return hash.computePoseidonHashOnElements([amount, tokenType, secret, nullifierSecret]);
}

/**
 * Bet commitment = Poseidon(outcome, amount, secret, nullifier_secret)
 */
export function computeBetCommitment(
  outcome: string,
  amount: string,
  secret: string,
  nullifierSecret: string,
): string {
  return hash.computePoseidonHashOnElements([outcome, amount, secret, nullifierSecret]);
}

/**
 * Vote commitment = Poseidon(choice, secret, nullifier_secret)
 */
export function computeVoteCommitment(
  choice: string,
  secret: string,
  nullifierSecret: string,
): string {
  return hash.computePoseidonHashOnElements([choice, secret, nullifierSecret]);
}
