import { RpcProvider, hash } from "starknet";

const provider = new RpcProvider({ 
  nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH" 
});

const DEMO_COUNTER = "0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde";

console.log("Fetching DemoCounter state...\n");

// Call get_count()
const countSelector = hash.getSelectorFromName("get_count");
const countResult = await provider.callContract({
  contractAddress: DEMO_COUNTER,
  entrypoint: "get_count",
  calldata: []
});

// Call get_last_caller()
const lastCallerResult = await provider.callContract({
  contractAddress: DEMO_COUNTER,
  entrypoint: "get_last_caller",
  calldata: []
});

const count = BigInt(countResult[0]);
const lastCaller = countResult.length > 1 ? lastCallerResult[0] : "0x0";

console.log(`Current count: ${count}`);
console.log(`Last caller: ${lastCaller}`);
console.log(`\nExpected caller (ShieldedPool): 0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2`);
