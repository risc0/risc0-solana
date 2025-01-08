/**
 * Executes an emergency stop on a verifier in the RISC Zero Router. This is an irreversible action that will permanently disable the specified verifier.
 * The script includes multiple confirmation steps to prevent accidental execution.
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
 * 1. Verifier selector number
 * 2. Confirmation of the selector number
 * 3. Explicit confirmation phrase "YES CALL EMERGENCY STOP"
 *
 * ## Usage Example
 *
 * ```bash
 * # Basic usage with local keypair
 * yarn run estop
 *
 * # With custom router address
 * ROUTER_ADDRESS=DNzgxRPwrWW7ZVTVWr5zhhHAJMjzs3B17eVpZVJfvzHa \
 * yarn run estop
 *
 * # With Fireblocks
 * FIREBLOCKS_PRIVATE_KEY_PATH=~/fireblocks_secret.key \
 * FIREBLOCKS_API_KEY=your-api-key \
 * FIREBLOCKS_BASE_PATH=sandbox \
 * FIREBLOCKS_VAULT=0 \
 * yarn run estop
 * ```
 */
import {
  createLogger,
  createRpc,
  getRouterAddress,
  getTransactionSigner,
} from "./utils/utils";
import * as readline from "readline/promises";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
import { estopByOwner } from "./utils/estop";

const logger = createLogger();

async function collectUserInput(): Promise<number> {
  console.log(
    "Script to call Estop initiated, answer the following questions to continue:"
  );
  const input = Number(await rl.question("Enter Verifier selector (u32): "));
  const verify = Number(
    await rl.question(`Reenter verifier selector to confirm: `)
  );
  if (input !== verify) {
    logger.error("Inputs did not match, Exiting.");
    process.exit(1);
  }
  const confirm = await rl.question(
    'Type "YES CALL EMERGENCY STOP" to confirm: '
  );
  if (confirm !== "YES CALL EMERGENCY STOP") {
    logger.error("User input did not match above confirmation, Exiting.");
    process.exit(1);
  }
  rl.close();
  return input;
}

async function run_estop() {
  logger.info("Verifier Estop By Owner Script Started");
  logger.warn(
    "CALLING E-STOP ON A VERIFIER IS IRREVERSIBLE, MAKE SURE THIS IS WHAT YOU WANT TO DO"
  );
  const rpc = createRpc();

  const routerAddress = getRouterAddress();
  const owner = await getTransactionSigner();
  const selector = await collectUserInput();
  await estopByOwner(
    rpc.rpc,
    rpc.rpc_subscription,
    routerAddress,
    owner,
    selector
  );

  logger.info("Estop by Owner script has completed");
}

run_estop().catch((error) => console.error(error));
