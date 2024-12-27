/**
 * Builds, deploys, and initializes the Risc0 Verification Router and Initial Groth16 Verifier program on the Solana blockchain.
 * This script handles the complete deployment pipeline including building programs, deploying them on-chain, and
 * performing initial setup.
 *
 * ## Environment Variables
 *
 * - `LOG_LEVEL` - (Optional) Log level for output
 *                 ["silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal"]. Defaults to "info"
 * - `MINIMUM_DEPLOY_BALANCE` - (Optional) Minimum SOL balance required in deployer account.
 *                              Defaults to 6 SOL
 * - `MINIMUM_BALANCE` - (Optional) Minimum SOL balance required in owner account. Defaults to 1 SOL
 * - `VERIFIABLE` - (Optional) Whether to build programs with verification enabled ["true" | "false"].
 *                  Defaults to false
 * - `RPC` - (Optional) RPC endpoint for Solana. Defaults to "http://localhost:8899"
 * - `RPC_SUBSCRIPTION` - (Optional) WebSocket endpoint for Solana. Defaults to "ws://localhost:8900"
 * - `KEY_PAIR_FILE` - (Optional) Path to keypair file. Defaults to "~/.config/solana/id.json"
 *
 * ### Fireblocks Support (Optional)
 * If using Fireblocks:
 * - `FIREBLOCKS_PRIVATE_KEY_PATH` - Path to Fireblocks API private key
 * - `FIREBLOCKS_API_KEY` - Fireblocks API key
 * - `FIREBLOCKS_BASE_PATH` - (Optional) Fireblocks API base path ["sandbox" | "us" | "eu" | "eu2"]
 *                            Defaults to "sandbox"
 * - `FIREBLOCKS_ASSET_ID` - (Optional) Asset ID in Fireblocks. Defaults to "SOL_TEST"
 * - `FIREBLOCKS_VAULT` - Vault account ID in Fireblocks
 *
 * ## Usage Example
 *
 * ```bash
 * # Basic usage with local keypair
 * yarn run deploy
 *
 * # With custom RPC endpoints
 * RPC=https://api.mainnet-beta.solana.com \
 * RPC_SUBSCRIPTION=wss://api.mainnet-beta.solana.com \
 * yarn run deploy
 *
 * # With Fireblocks
 * FIREBLOCKS_PRIVATE_KEY_PATH=~/fireblocks_secret.key \
 * FIREBLOCKS_API_KEY=your-api-key \
 * FIREBLOCKS_BASE_PATH=sandbox \
 * FIREBLOCKS_VAULT=0 \
 * yarn run deploy
 * ```
 */
import { build_cli, codama_cli, deploy_cli } from "./utils/deploy";
import {
  changeAuthority,
  createLogger,
  createRpc,
  getLocalKeypair,
  getRouterPda,
  getTransactionSigner,
  LAMPORTS_PER_SOL,
  loadMinimumDeployBalance,
  loadMinimumScriptBalance,
  Programs,
  verifiable,
} from "./utils/utils";
import { initializeRouter } from "./utils/init";
import { addVerifier } from "./utils/addVerifier";

const logger = createLogger();

async function run_deployment(): Promise<void> {
  logger.info("Risc0 Solana Program Deployment Script started");

  const owner = await getTransactionSigner();
  const deployer = await getLocalKeypair();
  const verify = verifiable();
  const rpc = createRpc();

  logger.info("Checking account balances before starting deploy.");

  let insufficient_balance = false;
  const minimumDeployBalance = loadMinimumDeployBalance();
  const currentDeployBalance = await rpc.rpc
    .getBalance(deployer.address)
    .send();
  const minimumDeploySol = minimumDeployBalance / LAMPORTS_PER_SOL;
  const currentDeploySol = currentDeployBalance.value / LAMPORTS_PER_SOL;

  if (currentDeployBalance.value < minimumDeployBalance) {
    logger.error(
      `Deployer Account: ${deployer.address} does not have the minimum balance of ${minimumDeploySol} SOL`
    );
    logger.error(`Account shows balance of ${currentDeploySol} SOL.`);
    logger.error(
      "Please add more SOL to the deployer account and run again, OR change the minimum balance by setting the MINIMUM_DEPLOY_BALANCE env value"
    );
    insufficient_balance = true;
  }

  const minimumScriptBalance = loadMinimumScriptBalance();
  const currentScriptBalance = await rpc.rpc.getBalance(owner.address).send();
  const minimumScriptSol = minimumScriptBalance / LAMPORTS_PER_SOL;
  const currentScriptSol = currentScriptBalance.value / LAMPORTS_PER_SOL;

  if (currentScriptBalance.value < minimumScriptBalance) {
    logger.error(
      `Owner Account: ${owner.address} does not have the minimum balance of ${minimumScriptSol} SOL`
    );
    logger.error(`Account shows balance of ${currentScriptSol} SOL.`);
    logger.error(
      "Please add more SOL to the owner account and run again, OR change the minimum balancne by setting the MINIMUM_BALANCE env value"
    );
    insufficient_balance = true;
  }

  if (insufficient_balance) {
    process.exit(1);
  }

  logger.info("Accounts have minimum SOL balance to continue");

  // Build and deploy the Solana programs on chain
  logger.info("Attempting to sync keys and build programs for deployment");

  if (!verify) {
    logger.warn("Build is not going to be verifiable");
  }
  await build_cli();
  logger.info("Build of Solana programs was successful");

  await codama_cli();
  logger.info("Regeneration of Typescript client code successful");

  const routerAddress = await deploy_cli(
    Programs.VerifierRouter,
    verify,
    false // Router should not be upgradable
  );
  logger.info(`Verifier Router Program Address will be: ${routerAddress}`);

  const verifier_address = await deploy_cli(
    Programs.Groth16Verifier,
    verify,
    // Verifier should be upgradable so that router can close it
    // In the add verifier stage, router programs becomes upgrade
    // authority
    true
  );
  logger.info(`Groth 16 Verifier Program Address will be: ${verifier_address}`);

  logger.info("Programs successfully deployed");

  // Initialize the Router by setting owner for the contract and creating the PDA
  await initializeRouter(rpc.rpc, rpc.rpc_subscription, routerAddress, owner);

  // Setup the Groth 16 Verifiers Upgrade authority to be the Router PDA
  const routerPda = await getRouterPda(routerAddress);
  await changeAuthority(
    rpc.rpc,
    rpc.rpc_subscription,
    verifier_address,
    deployer,
    routerPda.address
  );

  // Add the Groth 16 Verifier to the Router
  await addVerifier(
    rpc.rpc,
    rpc.rpc_subscription,
    verifier_address,
    routerAddress,
    owner
  );

  logger.info("Programs deployed and initialized");
}

run_deployment().catch((error) => console.error(error));
