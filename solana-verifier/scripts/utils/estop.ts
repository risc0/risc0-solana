import {
  Address,
  Rpc,
  SolanaRpcApi,
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from "@solana/kit";

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

/**
 * Executes an emergency stop of a verifier program by its owner
 *
 * CRITICAL: This is an irreversible action that will permanently disable the verifier.
 * The function includes a 5-second delay to prevent accidental execution.
 *
 * This operation will:
 * 1. Close the verifier program account
 * 2. Close the verifier entry account
 * 3. Permanently disable the verifier's selector
 * 4. Return rent from closed accounts to the owner
 *
 * @param {Rpc<SolanaRpcApi>} rpc - RPC connection to Solana
 * @param {RpcSubscriptions<SolanaRpcSubscriptionsApi>} rpcSubscriptions - WebSocket connection for transaction confirmation
 * @param {Address<string>} routerAddress - Address of the verifier router program
 * @param {TransactionSigner} owner - The owner authorized to emergency stop the verifier
 * @param {number} selector - The selector identifying the verifier to stop
 *
 * @returns {Promise<void>} Resolves when the emergency stop is confirmed
 * @throws If the transaction fails or if the owner lacks proper authorization
 *
 * @security This function requires owner authorization and affects critical program state
 * @warning Once executed, this action cannot be undone. The selector cannot be reused.
 */
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
