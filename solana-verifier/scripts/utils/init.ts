import { promisify } from "util";
import process from "child_process";
import {
  verifiable,
  loadDefaultKeypair,
  loadOwnerAddress,
  Programs,
  getLocalKeypair,
  sendTransaction,
  createRpc,
  getTransactionSigner,
  getRouterPda,
  createLogger,
} from "./utils";
import {
  address,
  Address,
  createSolanaRpc,
  createTransactionMessage,
  getProgramDerivedAddress,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  TransactionSigner,
} from "@solana/web3.js";
import { getInitializeInstruction } from "../verify-router";

export async function initilizeRouter(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  routerAddress: Address<string>,
  owner: TransactionSigner
): Promise<void> {
  const log = createLogger();

  log.info(
    `Initilizing the Verifier Router at address: ${routerAddress} with owner: ${owner.address}`
  );
  // Configrue the Verifier Router program
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
    "Attempting to submit the Verifier Router Initilization Instruction"
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
