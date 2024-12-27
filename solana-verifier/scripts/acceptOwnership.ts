/**
 * # acceptOwnership.ts
 *
 * Completes the ownership transfer of the Risc0 Router by accepting the pending transfer. This script must be run by the new owner after the
 * transferOwnership script has been executed by the current owner.
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
 * ## Usage Example
 *
 * ```bash
 * # Basic usage with local keypair
 * yarn run accept
 *
 * # With custom router address
 * ROUTER_ADDRESS=DNzgxRPwrWW7ZVTVWr5zhhHAJMjzs3B17eVpZVJfvzHa \
 * yarn run accept
 *
 * # With Fireblocks
 * FIREBLOCKS_PRIVATE_KEY_PATH=~/fireblocks_secret.key \
 * FIREBLOCKS_API_KEY=your-api-key \
 * FIREBLOCKS_BASE_PATH=sandbox \
 * FIREBLOCKS_VAULT=0 \
 * yarn run accept
 * ```
 */
import {
  createLogger,
  createRpc,
  getRouterAddress,
  getTransactionSigner,
} from "./utils/utils";
import { acceptOwnership } from "./utils/ownership";

const logger = createLogger();

async function runAcceptOwnership() {
  logger.info("Verifier Router Ownership Acceptance Script started");

  const rpc = createRpc();
  const newOwner = await getTransactionSigner();
  const routerAddress = getRouterAddress();

  await acceptOwnership(rpc.rpc, rpc.rpc_subscription, routerAddress, newOwner);

  logger.info("Verifier Router Ownership Acceptance Script Completed");
}

runAcceptOwnership().catch((error) => console.error(error));
