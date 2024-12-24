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
