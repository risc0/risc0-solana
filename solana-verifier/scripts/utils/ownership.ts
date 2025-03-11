import {
  Rpc,
  SolanaRpcApi,
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
  Address,
  TransactionSigner,
} from "@solana/kit";
import {
  fetchVerifierRouter,
  getAcceptOwnershipInstruction,
  getCancelTransferInstruction,
  getRenounceOwnershipInstruction,
  getTransferOwnershipInstruction,
} from "../verify-router";
import { createLogger, getRouterPda, sendTransaction, sleep } from "./utils";

const logger = createLogger();

/**
 * Initiates the transfer of router ownership to a new address
 *
 * This is part of a two-step ownership transfer process:
 * 1. Current owner initiates transfer by calling this function
 * 2. New owner must accept the transfer by calling acceptOwnership
 *
 * The transfer remains pending until accepted or cancelled.
 *
 * @param {Rpc<SolanaRpcApi>} rpc - RPC connection to Solana
 * @param {RpcSubscriptions<SolanaRpcSubscriptionsApi>} rpcSubscriptions - WebSocket connection for transaction confirmation
 * @param {Address<string>} routerAddress - Address of the verifier router program
 * @param {TransactionSigner} owner - Current owner initiating the transfer
 * @param {Address<string>} newOwner - Address that will receive ownership rights
 *
 * @returns {Promise<void>} Resolves when transfer initiation is confirmed
 * @throws If caller is not the current owner or if transaction fails
 *
 * @security Requires current owner's signature
 * @see acceptOwnership - Required follow-up action by new owner
 */
export async function transferOwnership(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  owner: TransactionSigner,
  newOwner: Address<string>
) {
  logger.info(
    `Transferring ownership from ${owner.address} to new owner: ${newOwner} for router ${routerAddress}`
  );

  const routerPda = await getRouterPda(routerAddress);
  logger.debug(
    `Using Router PDA Address: ${routerPda.address} with bump: ${routerPda.bump}`
  );

  const transferOwnershipInstruction = getTransferOwnershipInstruction(
    {
      authority: owner,
      newOwner: newOwner,
      state: routerPda.address,
    },
    {
      programAddress: routerAddress,
    }
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: owner,
    instruction: transferOwnershipInstruction,
  });

  logger.info(
    "Ownership transfer transaction confirmed, have the new owner accept the role"
  );
}

/**
 * Completes a pending ownership transfer by the new owner accepting the role
 *
 * Second step of the two-step ownership transfer process. The new owner must
 * explicitly accept ownership by calling this function. Upon acceptance:
 * - Previous owner loses all administrative rights
 * - New owner gains full administrative control
 *
 * @param {Rpc<SolanaRpcApi>} rpc - RPC connection to Solana
 * @param {RpcSubscriptions<SolanaRpcSubscriptionsApi>} rpcSubscriptions - WebSocket connection for transaction confirmation
 * @param {Address<string>} routerAddress - Address of the verifier router program
 * @param {TransactionSigner} newOwner - The pending owner accepting the transfer
 *
 * @returns {Promise<void>} Resolves when ownership transfer is completed
 * @throws If caller is not the pending owner or if no transfer is pending
 *
 * @security Changes critical program authority
 * @notice This action gives full administrative control to the new owner
 */
export async function acceptOwnership(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  newOwner: TransactionSigner
) {
  logger.info(`Accepting ownership of router ${routerAddress}`);

  const routerPda = await getRouterPda(routerAddress);
  logger.debug(
    `Using Router PDA Address: ${routerPda.address} with bump: ${routerPda.bump}`
  );

  const acceptOwnershipTransferInstruction = getAcceptOwnershipInstruction(
    {
      authority: newOwner,
      state: routerPda.address,
    },
    {
      programAddress: routerAddress,
    }
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: newOwner,
    instruction: acceptOwnershipTransferInstruction,
  });

  logger.info(
    `Ownership transfer completed, ${newOwner.address} now has the ownership role`
  );
}

/**
 * Cancels a pending ownership transfer
 *
 * Can be called by either the current owner or the pending owner to
 * cancel a pending ownership transfer. After cancellation:
 * - Current owner retains all rights
 * - Pending owner can no longer accept the transfer
 * - A new transfer must be initiated for any future ownership change
 *
 * @param {Rpc<SolanaRpcApi>} rpc - RPC connection to Solana
 * @param {RpcSubscriptions<SolanaRpcSubscriptionsApi>} rpcSubscriptions - WebSocket connection for transaction confirmation
 * @param {Address<string>} routerAddress - Address of the verifier router program
 * @param {TransactionSigner} authority - Either current owner or pending owner
 *
 * @returns {Promise<void>} Resolves when cancellation is confirmed
 * @throws If caller is neither current nor pending owner, or if no transfer is pending
 *
 * @notice Can be called by either current or pending owner
 */
export async function cancelTransfer(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  authority: TransactionSigner
) {
  logger.info(`Canceling the ownership transfer on router ${routerAddress}`);

  const routerPda = await getRouterPda(routerAddress);
  logger.debug(
    `Using Router PDA Address: ${routerPda.address} with bump: ${routerPda.bump}`
  );

  const routerData = await fetchVerifierRouter(rpc, routerPda.address);

  const cancelOwnershipTransferInstruction = getCancelTransferInstruction(
    {
      authority,
      state: routerPda.address,
    },
    {
      programAddress: routerAddress,
    }
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: authority,
    instruction: cancelOwnershipTransferInstruction,
  });

  logger.info(
    `Ownership transfer cancellation transaction confirmed. ${routerData.data.ownership.pendingOwner} may no longer accept ownership of the transfer.`
  );
}

/**
 * Permanently renounces ownership of the router program
 *
 * CRITICAL: This is an irreversible action that permanently removes owner authority.
 * After renouncement:
 * - No new verifiers can be added
 * - Emergency stops can only be triggered by proof of exploit
 * - No future owner can be set
 *
 * Includes a 5-second delay to prevent accidental execution.
 *
 * @param {Rpc<SolanaRpcApi>} rpc - RPC connection to Solana
 * @param {RpcSubscriptions<SolanaRpcSubscriptionsApi>} rpcSubscriptions - WebSocket connection for transaction confirmation
 * @param {Address<string>} routerAddress - Address of the verifier router program
 * @param {TransactionSigner} owner - Current owner renouncing their rights
 *
 * @returns {Promise<void>} Resolves when renouncement is confirmed
 * @throws If caller is not the current owner or if transaction fails
 *
 * @security This is an irreversible action
 * @warning After this action, certain program features become permanently unavailable
 */
export async function renounceOwnership(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  owner: TransactionSigner
) {
  logger.warn("RENOUNCE OWNERSHIP HAS BEEN CALLED, THIS IS IRREVERSIBLE...");
  logger.warn(
    "Once renounced no new verifier may be added to the router, and Emergency Stop can only be called by producing a verifiably bad proof."
  );
  logger.warn(
    "Program will sleep for 5 seconds. Kill program if you wish to stop NOW."
  );

  await sleep(5000);

  logger.info(`Renouncing ownership of router at address ${routerAddress}`);

  const routerPda = await getRouterPda(routerAddress);
  logger.debug(
    `Using Router PDA Address: ${routerPda.address} with bump: ${routerPda.bump}`
  );

  const renounceOwnershipInstruction = getRenounceOwnershipInstruction(
    {
      authority: owner,
      state: routerPda.address,
    },
    {
      programAddress: routerAddress,
    }
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: owner,
    instruction: renounceOwnershipInstruction,
  });

  logger.info(
    "Ownership has been renounced, no new verifier may be added to the router."
  );
}
