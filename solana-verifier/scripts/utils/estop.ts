import {
  Address,
  Rpc,
  SolanaRpcApi,
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from "@solana/web3.js";

import {
  createLogger,
  getProgramDataAddress,
  getRouterPda,
  getVerifierEntryPda,
  sendTransaction,
  sleep,
} from "./utils";
import {
  fetchVerifierEntry,
  getEmergencyStopInstruction,
} from "../verify-router";
import { SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS } from "../loaderV3";

const logger = createLogger();

export async function estopByOwner(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  owner: TransactionSigner,
  selector: number
): Promise<void> {
  logger.warn(
    "EMERGENCY STOP HAS BEEN STARTED, THIS IS IRREVERSABLE...Program Will sleep for 5 seconds Kill program immediatly if not intentional, attempting to terminate a verifier!"
  );
  logger.info(
    `Emeregency Stop attempting to stop verifier with Selector: ${selector} on router ${routerAddress}`
  );

  await sleep(5000); // Sleep for 5 seconds in case this was an accident

  const routerPda = await getRouterPda(routerAddress);

  const verifierEntryPda = await getVerifierEntryPda(routerAddress, selector);

  const verifierEntry = await fetchVerifierEntry(rpc, verifierEntryPda.address);

  const verifierAddress = verifierEntry.data.verifier;

  const verifierProgramData = await getProgramDataAddress(verifierAddress);

  logger.info(
    `Attempting to terminate verifier with address: ${verifierAddress}`
  );

  const estopInstruction = getEmergencyStopInstruction(
    {
      authority: owner,
      bpfLoaderUpgradableProgram: SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
      router: routerPda.address,
      selector,
      verifierEntry: verifierEntryPda.address,
      verifierProgram: verifierAddress,
      verifierProgramData: verifierProgramData.address,
    },
    {
      programAddress: routerAddress,
    }
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: owner,
    instruction: estopInstruction,
    commitment: "confirmed",
  });

  logger.info("Estop by owner has been confirmed");
}
