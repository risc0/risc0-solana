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
