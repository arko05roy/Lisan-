import { RpcProvider } from "starknet";

const provider = new RpcProvider({ 
  nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH" 
});

const txHash = "0x3a9d018fce98065569e069f6527c235e229a21218959a40d148eccb9381c62d";

console.log("Fetching transaction receipt...\n");

try {
  const receipt = await provider.getTransactionReceipt(txHash);
  
  console.log("Transaction Status:", receipt.execution_status);
  console.log("\nEvents:");
  
  receipt.events.forEach((event, i) => {
    console.log(`\n--- Event ${i} ---`);
    console.log("From contract:", event.from_address);
    console.log("Keys:", event.keys);
    console.log("Data:", event.data);
  });
  
  console.log("\n\nLooking for DemoCounter events...");
  const demoCounterAddr = "0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde";
  
  const counterEvents = receipt.events.filter(e => 
    BigInt(e.from_address) === BigInt(demoCounterAddr)
  );
  
  if (counterEvents.length > 0) {
    console.log(`\n✅ Found ${counterEvents.length} event(s) from DemoCounter!`);
    counterEvents.forEach((event, i) => {
      console.log(`\nDemoCounter Event ${i}:`);
      console.log("Keys:", event.keys);
      console.log("Data:", event.data);
      if (event.data.length >= 2) {
        console.log("Caller (from event):", event.data[0]);
        console.log("New count:", BigInt(event.data[1]));
      }
    });
  } else {
    console.log("\n❌ No events found from DemoCounter");
  }
  
} catch (e) {
  console.error("Error:", e.message);
}
