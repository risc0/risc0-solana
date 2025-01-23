/**
 * Adds a new verifier program to an existing RISC Zero Router. This script handles changing the verifier's upgrade authority to the router and registering it in the router's registry.
 *
 * ## Environment Variables
 *
 * - `LOG_LEVEL` - (Optional) Log level for output ["silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal"]. Defaults to "info"
 * - `ROUTER_ADDRESS` - (Optional) Address of the router program. If not set, uses the address from the latest build
 * - `VERIFIER_ADDRESS` - (Optional) Address of the verifier program to add. If not set, uses the Groth16 verifier address from the latest build
 * - `KEY_PAIR_FILE` - (Optional) Path to keypair file. Defaults to "~/.config/solana/id.json"
 * - `RPC` - (Optional) RPC endpoint for Solana. Defaults to "http://localhost:8899"
 * - `RPC_SUBSCRIPTION` - (Optional) WebSocket endpoint for Solana. Defaults to "ws://localhost:8900"
 *
 * ### Fireblocks Support (Optional)
 * If using Fireblocks:
 * - `FIREBLOCKS_PRIVATE_KEY_PATH` - Path to Fireblocks API private key
 * - `FIREBLOCKS_API_KEY` - Fireblocks API key
 * - `FIREBLOCKS_BASE_PATH` - Fireblocks API base path ["sandbox" | "us" | "eu" | "eu2"]
 * - `FIREBLOCKS_ASSET_ID` - (Optional) Asset ID in Fireblocks. Defaults to "SOL_TEST"
 * - `FIREBLOCKS_VAULT` - Vault account ID in Fireblocks
 *
 * ## Usage Example
 *
 * ```bash
 * # Basic usage with local keypair
 * yarn run add
 *
 * # With custom addresses
 * ROUTER_ADDRESS=DNzgxRPwrWW7ZVTVWr5zhhHAJMjzs3B17eVpZVJfvzHa \
 * VERIFIER_ADDRESS=Hs9zHQshowrEM4tyRCv9vwcPkZSBbU1cVCUGLwZmVawa \
 * yarn run add
 *
 * # With Fireblocks
 * FIREBLOCKS_PRIVATE_KEY_PATH=~/fireblocks_secret.key \
 * FIREBLOCKS_API_KEY=your-api-key \
 * FIREBLOCKS_BASE_PATH=sandbox \
 * FIREBLOCKS_VAULT=0 \
 * yarn run add
 * ```
 */

import {
  createRpc,
  changeAuthority,
  getLocalKeypair,
  getRouterAddress,
  getTransactionSigner,
  getVerifierAddress,
  getRouterPda,
  createLogger,
} from "./utils/utils";
import { addVerifier } from "./utils/addVerifier";

const logger = createLogger();
async function runAddVerifier() {
  logger.info("Running script to add a new verifier to the Router");
  const verifierAddress = getVerifierAddress();
  const routerAddress = getRouterAddress();
  const deployer = await getLocalKeypair();
  const owner = await getTransactionSigner();

  logger.info(
    `Using Router: ${routerAddress}, adding verifier ${verifierAddress}`
  );

  const rpc = createRpc();

  // TODO: Check who is the current authority and only call set authority if not currently set
  logger.info("Changing Verifier Upgrade Authority to be the router program");

  const routerPda = await getRouterPda(routerAddress);
  await changeAuthority(
    rpc.rpc,
    rpc.rpc_subscription,
    verifierAddress,
    deployer,
    routerPda.address
  );

  logger.info("Adding the verifier to the Router");
  await addVerifier(
    rpc.rpc,
    rpc.rpc_subscription,
    verifierAddress,
    routerAddress,
    owner
  );

  logger.info("Verifier was successfully added to the router");
}

runAddVerifier().catch((error) => console.error(error));
