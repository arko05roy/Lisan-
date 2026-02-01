import { Account, RpcProvider, json } from "starknet";
import { readFileSync } from "fs";

const DEPLOYER_ADDRESS = process.env.RELAYER_ADDRESS;
const DEPLOYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.STARKNET_RPC_URL;

if (!DEPLOYER_ADDRESS || !DEPLOYER_PRIVATE_KEY) {
  console.error("Error: RELAYER_ADDRESS and RELAYER_PRIVATE_KEY must be set in .env");
  process.exit(1);
}

async function deploy() {
  console.log("🚀 Deploying contracts...\n");

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);

  console.log("Deployer:", DEPLOYER_ADDRESS);
  console.log("Network:", RPC_URL, "\n");

  // Deploy MockGroth16Verifier
  console.log("📝 Deploying MockGroth16Verifier...");
  const verifierContract = json.parse(
    readFileSync("./lisan_contracts/target/dev/lisan_contracts_MockGroth16Verifier.contract_class.json").toString("ascii")
  );

  const verifierDeclare = await account.declare({ contract: verifierContract });
  await provider.waitForTransaction(verifierDeclare.transaction_hash);
  console.log("✅ Verifier declared:", verifierDeclare.class_hash);

  const verifierDeploy = await account.deployContract({
    classHash: verifierDeclare.class_hash,
    constructorCalldata: [],
  });
  await provider.waitForTransaction(verifierDeploy.transaction_hash);
  const verifierAddress = verifierDeploy.contract_address;
  console.log("✅ Verifier deployed:", verifierAddress, "\n");

  // Deploy ShieldedPool with the verifier
  console.log("📝 Deploying ShieldedPool...");
  const poolContract = json.parse(
    readFileSync("./lisan_contracts/target/dev/lisan_contracts_ShieldedPool.contract_class.json").toString("ascii")
  );

  const poolDeclare = await account.declare({ contract: poolContract });
  await provider.waitForTransaction(poolDeclare.transaction_hash);
  console.log("✅ Pool declared:", poolDeclare.class_hash);

  const poolDeploy = await account.deployContract({
    classHash: poolDeclare.class_hash,
    constructorCalldata: [verifierAddress, verifierAddress], // Use same verifier for both
  });
  await provider.waitForTransaction(poolDeploy.transaction_hash);
  const poolAddress = poolDeploy.contract_address;
  console.log("✅ Pool deployed:", poolAddress, "\n");

  console.log("🎉 Deployment complete!\n");
  console.log("📋 Update your .env.local file:");
  console.log(`NEXT_PUBLIC_SHIELDED_POOL=${poolAddress}`);
  console.log("\n🔧 To use the new pool:");
  console.log("1. Update .env.local with the new address");
  console.log("2. Restart your dev server");
  console.log("3. Test private execute with DemoCounter");
}

deploy().catch((e) => {
  console.error("Deployment failed:", e.message);
  process.exit(1);
});
