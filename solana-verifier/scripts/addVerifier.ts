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
    `Using Router: ${routerAddress}, adding verifier ${verifierAddress}`,
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
    routerPda.address,
  );

  logger.info("Adding the verifier to the Router");
  await addVerifier(
    rpc.rpc,
    rpc.rpc_subscription,
    verifierAddress,
    routerAddress,
    owner,
  );

  logger.info("Verifier was successfully added to the router");
}

runAddVerifier().catch((error) => console.error(error));
