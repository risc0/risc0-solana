import { Logger } from "tslog";
import { build_cli, deploy_cli } from "./utils/deploy";
import {
  changeAuthority,
  createRpc,
  getLocalKeypair,
  getRouterPda,
  getTransactionSigner,
  Programs,
  verifiable,
} from "./utils/utils";
import { initilizeRouter } from "./utils/init";
import { addVerifier } from "./utils/addVerifier";

const logger = new Logger();

async function run_deployment(): Promise<void> {
  logger.info("Risc0 Solana Program Deployment Script started");

  const owner = await getTransactionSigner();
  const deployer = await getLocalKeypair();
  const verify = verifiable();
  const rpc = createRpc();

  // Build and deploy the Solana programs on chain
  logger.info("Attempting to sync keys and build programs for deployment");

  if (verify) {
    logger.warn("Build is not going to be verifiable");
  }
  await build_cli();
  logger.info("Build of Solana programs was successful");

  const router_address = await deploy_cli(
    Programs.VerifierRouter,
    verify,
    false // Router should not be upgradable
  );
  logger.info(`Verifier Router Program Address will be: ${router_address}`);

  const verifier_address = await deploy_cli(
    Programs.Groth16Verifier,
    verify,
    // Verifier should be upgradable so that router can close it
    // In the add verifier stage, router programs becomes upgrade
    // authority
    true
  );
  logger.info(`Groth 16 Verifier Program Address will be: ${verifier_address}`);

  logger.info("Programs succesfully deployed");

  // Initilize the Router by setting owner for the contract and creating the PDA
  await initilizeRouter(rpc.rpc, rpc.rpc_subscription, router_address, owner);

  // Setup the Groth 16 Verifiers Upgrade authority to be the Router PDA
  const routerPda = await getRouterPda(router_address);
  const routerAddress = routerPda[0];
  await changeAuthority(
    rpc.rpc,
    rpc.rpc_subscription,
    router_address,
    deployer,
    routerAddress
  );

  // Add the Groth 16 Verifier to the Router
  await addVerifier(
    rpc.rpc,
    rpc.rpc_subscription,
    verifier_address,
    routerAddress,
    owner
  );

  logger.info("Programs deployed and initilized");
}

run_deployment().catch((error) => console.error(error));
