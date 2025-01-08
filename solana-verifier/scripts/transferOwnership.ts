/**
 * Initiates the transfer of ownership for the RISC Zero Router to a new owner. This is the first step in a two-step ownership transfer process. After this script is run,
 * the new owner must accept ownership using the acceptOwnership script.
 *
 * ## Environment Variables
 *
 * - `LOG_LEVEL` - (Optional) Log level for output ["silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal"]. Defaults to "info"
 * - `ROUTER_ADDRESS` - (Optional) Address of the router program. If not set, uses the address from the latest build
 * - `NEW_OWNER` - (Required) Public key of the new owner
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
 * NEW_OWNER=AnchoURaVvRYGHqrwEGqr83PUZjZYJu3VCqykkQxRPTo \
 * yarn run transfer
 *
 * # With custom router address
 * ROUTER_ADDRESS=DNzgxRPwrWW7ZVTVWr5zhhHAJMjzs3B17eVpZVJfvzHa \
 * NEW_OWNER=AnchoURaVvRYGHqrwEGqr83PUZjZYJu3VCqykkQxRPTo \
 * yarn run transfer
 *
 * # With Fireblocks
 * FIREBLOCKS_PRIVATE_KEY_PATH=~/fireblocks_secret.key \
 * FIREBLOCKS_API_KEY=your-api-key \
 * FIREBLOCKS_BASE_PATH=sandbox \
 * FIREBLOCKS_VAULT=0 \
 * NEW_OWNER=AnchoURaVvRYGHqrwEGqr83PUZjZYJu3VCqykkQxRPTo \
 * yarn run transfer
 * ```
 */
import {
  createLogger,
  createRpc,
  getNewOwnerAddress,
  getRouterAddress,
  getTransactionSigner,
} from "./utils/utils";
import { transferOwnership } from "./utils/ownership";

const logger = createLogger();

async function runTransferOwnership() {
  logger.info("Verifier Router Ownership Transfer Script started");

  const rpc = createRpc();
  const newOwner = getNewOwnerAddress();
  const owner = await getTransactionSigner();
  const routerAddress = getRouterAddress();

  await transferOwnership(
    rpc.rpc,
    rpc.rpc_subscription,
    routerAddress,
    owner,
    newOwner
  );

  logger.info("Verifier Router Ownership Transfer Script Completed");
}

runTransferOwnership().catch((error) => console.error(error));
