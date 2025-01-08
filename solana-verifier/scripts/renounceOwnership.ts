/**
 * Permanently renounces ownership of the RISC Zero Router. This is an irreversible action that will prevent any new verifiers from being added to the router.
 * After renouncement, emergency stops can only be triggered by providing proof of exploitation. The script includes confirmation steps to prevent accidental
 * execution.
 *
 * ## Environment Variables
 *
 * - `LOG_LEVEL` - (Optional) Log level for output ["silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal"]. Defaults to "info"
 * - `ROUTER_ADDRESS` - (Optional) Address of the router program. If not set, uses the address from the latest build
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
 * ## Interactive Prompts
 *
 * The script will ask for:
 * 1. Explicit confirmation phrase "YES CALL RENOUNCE OWNERSHIP"
 *
 * ## Usage Example
 *
 * ```bash
 * # Basic usage with local keypair
 * yarn run renounce
 *
 * # With custom router address
 * ROUTER_ADDRESS=DNzgxRPwrWW7ZVTVWr5zhhHAJMjzs3B17eVpZVJfvzHa \
 * yarn run renounce
 *
 * # With Fireblocks
 * FIREBLOCKS_PRIVATE_KEY_PATH=~/fireblocks_secret.key \
 * FIREBLOCKS_API_KEY=your-api-key \
 * FIREBLOCKS_BASE_PATH=sandbox \
 * FIREBLOCKS_VAULT=0 \
 * yarn run renounce
 * ```
 *
 * ## Warning
 *
 * This action is irreversible. Once ownership is renounced:
 * - No new verifiers can be added to the router
 * - Emergency stops can only be triggered with proof of exploit
 * - No new owner can be assigned
 */
import {
  createLogger,
  createRpc,
  getRouterAddress,
  getTransactionSigner,
} from "./utils/utils";
import { renounceOwnership } from "./utils/ownership";
import * as readline from "readline/promises";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const logger = createLogger();

async function ConfirmOperation() {
  console.log(
    "Script will Renounce Ownership, Verify intent by answering the prompt:"
  );
  const confirm = await rl.question(
    'Type "YES CALL RENOUNCE OWNERSHIP" to confirm: '
  );
  if (confirm !== "YES CALL RENOUNCE OWNERSHIP") {
    logger.error("User input did not match above confirmation, Exiting.");
    process.exit(1);
  }
  rl.close();
}

async function runRenounceOwnership() {
  logger.info("Verifier Router Renounce Ownership Script started");

  const rpc = createRpc();
  const owner = await getTransactionSigner();
  const routerAddress = getRouterAddress();

  await ConfirmOperation();

  await renounceOwnership(rpc.rpc, rpc.rpc_subscription, routerAddress, owner);

  logger.info("Verifier Router Renounce Ownership Script Completed");
}

runRenounceOwnership().catch((error) => console.error(error));
