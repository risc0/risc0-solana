import { sendTransaction, getRouterPda, createLogger } from "./utils";
import {
  Address,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from "@solana/web3.js";
import { getInitializeInstruction } from "../verify-router";

/**
 * Initializes a new verifier router program instance on Solana
 *
 * Creates and initializes a Program Derived Address (PDA) that will serve as the router
 * account for managing verifier programs. The router is initialized with the provided
 * owner as the authority who can add verifiers and perform administrative operations.
 *
 * The initialization includes:
 * - Creating a router PDA with seeds = [b"router"]
 * - Setting up initial ownership configuration
 * - Initializing verifier count to 0
 *
 * @param {Rpc<SolanaRpcApi>} rpc - RPC connection to Solana
 * @param {RpcSubscriptions<SolanaRpcSubscriptionsApi>} rpcSubscriptions - WebSocket connection for transaction confirmation
 * @param {Address<string>} routerAddress - Address of the verifier router program to initialize
 * @param {TransactionSigner} owner - The account that will be set as the initial owner
 *
 * @returns {Promise<void>} Resolves when initialization is confirmed on-chain
 * @throws If PDA creation fails or if the initialization transaction fails
 *
 * @security This sets up critical program state and ownership - ensure owner address is correct
 * @notice Only needs to be called once when deploying a new router program
 * @warn Will fail if program has been initialized before
 */
export async function initializeRouter(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  owner: TransactionSigner
): Promise<void> {
  const log = createLogger();

  log.info(
    `Initializing the Verifier Router at address: ${routerAddress} with owner: ${owner.address}`
  );
  // Configure the Verifier Router program
  const routerPDA = await getRouterPda(routerAddress);

  log.debug(
    `Router PDA address is: ${routerPDA.address} and the bump is: ${routerPDA.bump}`
  );

  const initInstruction = getInitializeInstruction(
    {
      authority: owner,
      router: routerPDA.address,
    },
    { programAddress: routerAddress }
  );

  log.info(
    "Attempting to submit the Verifier Router Initialization Instruction"
  );

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: owner,
    instruction: initInstruction,
    commitment: "confirmed",
  });

  log.info(`Router at address: ${routerAddress} has been initialized`);
}
