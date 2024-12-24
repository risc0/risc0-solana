import {
  Rpc,
  SolanaRpcApi,
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
  Address,
  TransactionSigner,
} from "@solana/web3.js";
import {
  fetchVerifierRouter,
  getAcceptOwnershipInstruction,
  getCancelTransferInstruction,
  getRenounceOwnershipInstruction,
  getTransferOwnershipInstruction,
} from "../verify-router";
import { createLogger, getRouterPda, sendTransaction, sleep } from "./utils";

const logger = createLogger();

export async function transferOwnership(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  owner: TransactionSigner,
  newOwner: Address<string>
) {
  logger.info(
    `Transferring ownership from ${owner} to new owner: ${newOwner} for router ${routerAddress}`
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
