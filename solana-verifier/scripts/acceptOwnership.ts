import {
  createLogger,
  createRpc,
  getNewOwnerAddress,
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
