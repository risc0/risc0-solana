import {
  createRpc,
  getRouterAddress,
  getTransactionSigner,
} from "./utils/utils";
import * as readline from "readline/promises";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
import { Logger } from "tslog";
import { estopByOwner } from "./utils/estop";

const logger = new Logger();

async function collectUserInput(): Promise<number> {
  console.log(
    "Script to call Estop initated, answer the following questions to continue:"
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
    "CALLING E-STOP ON A VERIFIER IS IRREVERSABLE, MAKE SURE THIS IS WHAT YOU WANT TO DO"
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
