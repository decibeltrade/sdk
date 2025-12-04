/**
 * ABI fetcher that gets all ABIs used by the Decibel SDK
 * Based on actual function calls found in the SDK source code
 */

import { Aptos, AptosConfig, MoveFunction, MoveFunctionId, Network } from "@aptos-labs/ts-sdk";
import * as fs from "fs";
import * as path from "path";

import { DecibelConfig, NETNA_CONFIG, TESTNET_CONFIG } from "../constants";
import { ABIData, ABIs } from "./types";

// @Todo: There should be a global config that takes care of config across all the packages and apps
// @Todo: Generate ABIs for all the networks as well, or as per global config depending upon how that will work
// Remove NETNA_CONFIG and use getSdkConfig() instead once we implement it as a global config
const CONFIGS = [NETNA_CONFIG, TESTNET_CONFIG];

// All modules used in the SDK (extracted from source code analysis)
const SDK_MODULES = [
  "admin_apis",
  "public_apis",
  "dex_accounts",
  "perp_engine",
  "usdc",
  "vault",
  "dex_accounts_vault_extension",
];

/**
 * Generates a safe filename based on the network configuration
 */
function getAbiFilename(config: DecibelConfig): string {
  // For CUSTOM networks, use a more descriptive name based on the config
  if (config.network === Network.CUSTOM) {
    // Check if it's NETNA by comparing package address or other unique identifier
    if (config.deployment.package === NETNA_CONFIG.deployment.package) {
      return "json/netna.json";
    }
    return "json/custom.json";
  }
  // For standard networks, use the network name
  return `json/${config.network.toLowerCase()}.json`;
}

async function fetchAllAbis(config: DecibelConfig): Promise<void> {
  console.log("🚀 Fetching ABIs for Decibel SDK functions...");
  console.log("📦 Package:", config.deployment.package);
  console.log("🌐 Network:", config.network);
  console.log("🔗 Fullnode:", config.fullnodeUrl);
  console.log();

  if (!config.deployment.package || !config.fullnodeUrl) {
    console.error("❌ Error: config.package or CONFIG.fullnodeUrl is not set");
    process.exit(1);
  }

  const aptosConfig = new AptosConfig({
    network: config.network,
    fullnode: config.fullnodeUrl,
  });

  const abis: ABIs = {};
  const errors: ABIData["errors"] = [];
  const aptos = new Aptos(aptosConfig);

  // Fetch entire modules at once (much more efficient!)
  for (const module of SDK_MODULES) {
    try {
      console.log("📡 Fetching entire module:", module);

      // Get the entire module ABI
      const moduleInfo = await aptos.getAccountModule({
        accountAddress: config.deployment.package,
        moduleName: module,
      });

      if (!moduleInfo.abi) {
        throw new Error("Module or ABI not found");
      }

      // Debug: Log the ABI structure
      console.log("📋 ABI structure for", module, ":", Object.keys(moduleInfo.abi));

      // Get only entry functions from the module
      const exposedFunctions: MoveFunction[] = moduleInfo.abi.exposed_functions;
      const entryFunctions = exposedFunctions.filter((f) => f.is_entry);

      console.log("🔍 Found", exposedFunctions.length, "exposed functions in", module);
      console.log("🧩 Keeping", entryFunctions.length, "entry functions in", module);

      for (const func of entryFunctions) {
        const functionId: MoveFunctionId = `${config.deployment.package}::${module}::${func.name}`;
        abis[functionId] = func;
      }

      console.log(
        "✅ Successfully collected",
        entryFunctions.length,
        "entry functions from",
        module,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log("❌", module, ":", errorMessage);
      errors.push({ module, function: "entire_module", error: errorMessage });
    }
  }

  // Create the final structure
  const totalFunctions = Object.keys(abis).length;

  const result: ABIData = {
    packageAddress: config.deployment.package,
    network: config.network,
    fullnodeUrl: config.fullnodeUrl,
    fetchedAt: new Date().toISOString(),
    abis,
    errors,
    summary: {
      totalModules: SDK_MODULES.length,
      totalFunctions,
      successful: totalFunctions,
      failed: errors.length,
    },
    modules: SDK_MODULES,
  };

  // Write to JSON file with network-specific filename
  const filename = getAbiFilename(config);
  const outputPath = path.join(__dirname, filename);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log();
  console.log("📊 Summary:");
  console.log("Total modules fetched:", SDK_MODULES.length);
  console.log("Total functions found:", result.summary.successful);
  console.log("Failed modules:", result.summary.failed);

  if (errors.length > 0) {
    console.log();
    console.log("❌ Errors:");
    errors.forEach(({ module, function: funcName, error }) => {
      console.log(module, "::", funcName, ":", error);
      console.log();
    });
  }

  console.log();
  console.log("📁 ABIs saved to:", outputPath);
  console.log();
  console.log("🎉 ABI fetching complete!");
}

// Run the script
if (require.main === module) {
  // Process configs sequentially to avoid race conditions
  void (async () => {
    for (const config of CONFIGS) {
      await fetchAllAbis(config).catch((error: unknown) => {
        console.error(`❌ Failed to fetch ABIs for ${config.network}:`, error);
      });
    }
  })();
}
