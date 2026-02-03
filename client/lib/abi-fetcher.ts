import { RpcProvider } from "starknet";

export interface AbiEntry {
  type: "function" | "event" | "struct" | "enum" | "interface" | "impl" | "constructor" | "l1_handler";
  name: string;
  inputs?: Array<{
    name: string;
    type: string;
  }>;
  outputs?: Array<{
    type: string;
  }>;
  state_mutability?: "view" | "external";
}

export interface FunctionAbi {
  name: string;
  inputs: Array<{
    name: string;
    type: string;
  }>;
  outputs: Array<{
    type: string;
  }>;
  stateMutability: "view" | "external";
}

// Extract callable functions from ABI
export function extractFunctions(abi: AbiEntry[]): FunctionAbi[] {
  const functions: FunctionAbi[] = [];

  for (const entry of abi) {
    if (entry.type === "function" && entry.name && entry.inputs) {
      functions.push({
        name: entry.name,
        inputs: entry.inputs || [],
        outputs: entry.outputs || [],
        stateMutability: entry.state_mutability || "external",
      });
    }

    // Handle interface entries (Cairo 1 contracts often have these)
    if (entry.type === "interface" && (entry as any).items) {
      for (const item of (entry as any).items) {
        if (item.type === "function" && item.name) {
          functions.push({
            name: item.name,
            inputs: item.inputs || [],
            outputs: item.outputs || [],
            stateMutability: item.state_mutability || "external",
          });
        }
      }
    }
  }

  // Filter out internal functions (starting with _) and sort
  return functions
    .filter((f) => !f.name.startsWith("_"))
    .sort((a, b) => {
      // Put external functions first, then view functions
      if (a.stateMutability !== b.stateMutability) {
        return a.stateMutability === "external" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

// Fetch ABI from contract address using Starknet RPC
export async function fetchContractAbi(
  provider: RpcProvider,
  contractAddress: string
): Promise<{ abi: AbiEntry[]; functions: FunctionAbi[] } | null> {
  try {
    // Normalize address
    const normalizedAddress = contractAddress.startsWith("0x")
      ? contractAddress
      : `0x${contractAddress}`;

    // Get the class at the contract address (this includes the ABI)
    const classInfo = await provider.getClassAt(normalizedAddress);

    if (!classInfo || !classInfo.abi) {
      console.warn("No ABI found for contract:", contractAddress);
      return null;
    }

    const abi = classInfo.abi as AbiEntry[];
    const functions = extractFunctions(abi);

    return { abi, functions };
  } catch (error) {
    console.error("Failed to fetch ABI:", error);
    return null;
  }
}

// Helper to parse complex Cairo types for display
export function getTypeDisplayName(type: string): string {
  // Handle common patterns
  if (type.includes("ContractAddress")) return "Address";
  if (type.includes("u256")) return "u256";
  if (type.includes("u128")) return "u128";
  if (type.includes("u64")) return "u64";
  if (type.includes("u32")) return "u32";
  if (type.includes("u16")) return "u16";
  if (type.includes("u8")) return "u8";
  if (type.includes("felt252")) return "felt252";
  if (type.includes("bool")) return "bool";
  if (type.includes("ByteArray")) return "string";
  if (type.includes("Array")) {
    const inner = type.match(/<(.+)>/)?.[1];
    return inner ? `Array<${getTypeDisplayName(inner)}>` : "Array";
  }
  if (type.includes("Span")) {
    const inner = type.match(/<(.+)>/)?.[1];
    return inner ? `Span<${getTypeDisplayName(inner)}>` : "Span";
  }
  if (type.includes("Option")) {
    const inner = type.match(/<(.+)>/)?.[1];
    return inner ? `Option<${getTypeDisplayName(inner)}>` : "Option";
  }

  // For custom types, just take the last part
  const parts = type.split("::");
  return parts[parts.length - 1];
}

// Get placeholder text for input based on type
export function getInputPlaceholder(type: string): string {
  if (type.includes("ContractAddress")) return "0x...";
  if (type.includes("u256") || type.includes("u128")) return "Amount in wei (e.g., 1000000000000000000)";
  if (type.includes("u64") || type.includes("u32") || type.includes("u16") || type.includes("u8")) return "Integer value";
  if (type.includes("felt252")) return "0x... or decimal number";
  if (type.includes("bool")) return "true or false";
  if (type.includes("ByteArray")) return "Text string";
  if (type.includes("Array") || type.includes("Span")) return "Comma-separated values";
  return "Enter value";
}

// Check if type is a simple type that can be directly entered
export function isSimpleType(type: string): boolean {
  return (
    type.includes("ContractAddress") ||
    type.includes("u256") ||
    type.includes("u128") ||
    type.includes("u64") ||
    type.includes("u32") ||
    type.includes("u16") ||
    type.includes("u8") ||
    type.includes("felt252") ||
    type.includes("bool") ||
    type.includes("ByteArray")
  );
}
