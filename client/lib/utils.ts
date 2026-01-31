import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert Starknet u256 return data to bigint.
 * Handles: raw bigint/string/number, {low, high} struct, [low, high] array.
 */
export function u256ToBigInt(data: unknown): bigint {
  if (!data) return 0n;
  if (typeof data === "bigint") return data;
  // u256 struct {low, high}
  if (typeof data === "object" && data !== null && "low" in data && "high" in data) {
    const obj = data as { low: bigint | string | number; high: bigint | string | number };
    return BigInt(obj.low) + (BigInt(obj.high) << 128n);
  }
  // Array [low, high]
  if (Array.isArray(data) && data.length === 2) {
    return BigInt(data[0]) + (BigInt(data[1]) << 128n);
  }
  try {
    return BigInt(data as string | number);
  } catch {
    return 0n;
  }
}
