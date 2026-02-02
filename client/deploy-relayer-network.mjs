import { Account, RpcProvider, json, CallData } from "starknet";
import { readFileSync } from "fs";

const DEPLOYER_ADDRESS = "0x046d2cac6a901884710a584b200795810f0d7956bce9638d274d71867171b00b";
const DEPLOYER_PRIVATE_KEY = "0x0149cde97f071114305d823bce14d1eb1c0146e0bf0c000f3ff06a3da54c2a52";
const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH";
const MOCK_BTC_ADDRESS = "0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f";
const SHIELDED_POOL_ADDRESS = "0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2";

async function deploy() {
  console.log("Deploying Relayer Network Contracts...\n");

  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  // starknet.js v8 uses options object for Account constructor
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: DEPLOYER_PRIVATE_KEY,
    cairoVersion: "1",
  });

  console.log("Deployer:", DEPLOYER_ADDRESS);
  console.log("Network:", RPC_URL);
  console.log("Mock BTC:", MOCK_BTC_ADDRESS);
  console.log("Shielded Pool:", SHIELDED_POOL_ADDRESS, "\n");

  // 1. Deploy RelayerRegistry
  console.log("[1/3] Deploying RelayerRegistry...");
  const registryContract = json.parse(
    readFileSync("../lisan_contracts/target/dev/lisan_contracts_RelayerRegistry.contract_class.json").toString("ascii")
  );

  const registryCasm = json.parse(
    readFileSync("../lisan_contracts/target/dev/lisan_contracts_RelayerRegistry.compiled_contract_class.json").toString("ascii")
  );

  console.log("  Declaring contract...");
  const registryDeclare = await account.declare({ contract: registryContract, casm: registryCasm });
  await provider.waitForTransaction(registryDeclare.transaction_hash);
  console.log("  Registry declared:", registryDeclare.class_hash);

  // Constructor: (stake_token: ContractAddress, min_stake: u256)
  // min_stake = 1 BTC = 1 * 10^18 wei
  console.log("  Deploying contract...");
  const registryDeploy = await account.deployContract({
    classHash: registryDeclare.class_hash,
    constructorCalldata: CallData.compile({
      stake_token: MOCK_BTC_ADDRESS,
      min_stake: { low: "1000000000000000000", high: "0" },
      owner: DEPLOYER_ADDRESS,
    }),
  });
  await provider.waitForTransaction(registryDeploy.transaction_hash);
  const registryAddress = registryDeploy.contract_address;
  console.log("  Registry deployed:", registryAddress, "\n");

  // 2. Deploy RelayerCoordinator
  console.log("[2/3] Deploying RelayerCoordinator...");
  const coordinatorContract = json.parse(
    readFileSync("../lisan_contracts/target/dev/lisan_contracts_RelayerCoordinator.contract_class.json").toString("ascii")
  );

  const coordinatorCasm = json.parse(
    readFileSync("../lisan_contracts/target/dev/lisan_contracts_RelayerCoordinator.compiled_contract_class.json").toString("ascii")
  );

  console.log("  Declaring contract...");
  const coordinatorDeclare = await account.declare({ contract: coordinatorContract, casm: coordinatorCasm });
  await provider.waitForTransaction(coordinatorDeclare.transaction_hash);
  console.log("  Coordinator declared:", coordinatorDeclare.class_hash);

  // Constructor: (registry, pool, fee_bps, slash_penalty_bps, max_failures)
  console.log("  Deploying contract...");
  const coordinatorDeploy = await account.deployContract({
    classHash: coordinatorDeclare.class_hash,
    constructorCalldata: CallData.compile({
      relayer_registry: registryAddress,
      shielded_pool: SHIELDED_POOL_ADDRESS,
      relayer_fee_bps: { low: "10", high: "0" },
      slash_penalty_bps: { low: "1000", high: "0" },
      max_failures_before_full_slash: { low: "3", high: "0" },
      owner: DEPLOYER_ADDRESS,
    }),
  });
  await provider.waitForTransaction(coordinatorDeploy.transaction_hash);
  const coordinatorAddress = coordinatorDeploy.contract_address;
  console.log("  Coordinator deployed:", coordinatorAddress, "\n");

  // 3. Set coordinator in registry
  console.log("[3/3] Setting coordinator in registry...");
  const setCoordinatorTx = await account.execute([
    {
      contractAddress: registryAddress,
      entrypoint: "set_coordinator",
      calldata: CallData.compile({
        coordinator: coordinatorAddress,
      }),
    },
  ]);
  await provider.waitForTransaction(setCoordinatorTx.transaction_hash);
  console.log("  Coordinator set in registry\n");

  console.log("Deployment complete!\n");
  console.log("Add these to your .env.local file:\n");
  console.log(`NEXT_PUBLIC_RELAYER_REGISTRY=${registryAddress}`);
  console.log(`NEXT_PUBLIC_RELAYER_COORDINATOR=${coordinatorAddress}\n`);
}

deploy().catch((e) => {
  console.error("\nDeployment failed:", e.message);
  console.error(e);
  process.exit(1);
});
