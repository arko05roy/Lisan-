import { RpcProvider } from "starknet";

const provider = new RpcProvider({ 
  nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH" 
});

const DEMO_COUNTER = "0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde";
const SHIELDED_POOL = "0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2";

console.log("Checking DemoCounter state...\n");

const countResult = await provider.callContract({
  contractAddress: DEMO_COUNTER,
  entrypoint: "get_count",
  calldata: []
});

const callerResult = await provider.callContract({
  contractAddress: DEMO_COUNTER,
  entrypoint: "get_last_caller",
  calldata: []
});

const count = parseInt(countResult[0], 16);
const lastCaller = callerResult[0];

console.log("Current count:", count);
console.log("Last caller:  ", lastCaller);
console.log("Expected:     ", SHIELDED_POOL);

const match = BigInt(lastCaller) === BigInt(SHIELDED_POOL);
console.log("\nMatch:", match ? "✅ YES!" : "❌ NO");

if (match) {
  console.log("\n🎉 SUCCESS! Privacy verified - the pool called the contract, not your wallet!");
} else if (BigInt(lastCaller) === 0n) {
  console.log("\n⚠️  Caller is 0x0 - contract may need another increment call");
}
