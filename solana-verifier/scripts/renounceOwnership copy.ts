import { Logger } from "tslog";
import {
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

const logger = new Logger();

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

  await renounceOwnership(rpc.rpc, rpc.rpc_subscription, routerAddress, owner);

  logger.info("Verifier Router Renounce Ownership Script Completed");
}

runRenounceOwnership().catch((error) => console.error(error));
