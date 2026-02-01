import { RpcProvider, Contract } from "starknet";

const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH";
const POOL_ADDRESS = "0x05379c158a4a1490655dfba5627d2ce6d2cbe4f4341696f4e80d0dc6560c2cba";

const provider = new RpcProvider({ nodeUrl: RPC_URL });

// Get contract class to see storage
const contractClass = await provider.getClassAt(POOL_ADDRESS);

console.log("Fetching verifier addresses from ShieldedPool...");

// Try to read the storage directly
// Storage layout: withdraw_verifier and transfer_verifier are the first two storage variables
try {
  const withdrawVerifier = await provider.getStorageAt(POOL_ADDRESS, "0x0");
  const transferVerifier = await provider.getStorageAt(POOL_ADDRESS, "0x1");
  
  console.log("Withdraw Verifier:", withdrawVerifier);
  console.log("Transfer Verifier:", transferVerifier);
} catch (e) {
  console.error("Error:", e.message);
}
