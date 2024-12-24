import {
  Address,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from "@solana/web3.js";
import {
  sendTransaction,
  getRouterPda,
  getVerifierEntryPda,
  getProgramDataAddress,
  createLogger,
} from "./utils";
import {
  fetchVerifierRouter,
  getAddVerifierInstruction,
} from "../verify-router";



const logger = createLogger();

export async function addVerifier(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  verifierAddress: Address<string>,
  routerAddress: Address<string>,
  owner: TransactionSigner,
): Promise<void> {
  logger.info(
    `Risc0 Verifier being with address: ${verifierAddress} being added to the router at address: ${routerAddress}`,
  );

  logger.debug(`Using the address: ${owner.address} as owner`);

  const routerPDA = await getRouterPda(routerAddress);

  logger.debug(
    `Router PDA address is: ${routerPDA.address} and the bump is: ${routerPDA.bump}`,
  );

  const routerData = await fetchVerifierRouter(rpc, routerPDA.address);

  logger.debug(
    `Current verifier entry count is ${routerData.data.verifierCount}`,
  );

  const selector = routerData.data.verifierCount + 1;

  logger.info(
    `Using ${selector} as the selector for the verifier at address ${verifierAddress}`,
  );

  const routerEntry = await getVerifierEntryPda(routerAddress, selector);

  const verifierProgramData = await getProgramDataAddress(verifierAddress);

  logger.info(`Attempting to send add verifier transaction`);

  const addVerifierInstruction = getAddVerifierInstruction(
    {
      authority: owner,
      router: routerPDA.address,
      selector,
      verifierEntry: routerEntry.address,
      verifierProgram: verifierAddress,
      verifierProgramData: verifierProgramData.address,
    },
    { programAddress: routerAddress },
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: owner,
    instruction: addVerifierInstruction,
  });

  logger.info("Add verifier transaction confirmed on chain");
}
