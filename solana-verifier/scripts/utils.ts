import fs from "fs";
import path from "path";
import os from "os";

import {
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstruction,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  createTransactionMessage,
  pipe,
  SolanaRpcSubscriptionsApi,
  Commitment,
  BaseTransactionMessage,
  TransactionPartialSigner,
  createKeyPairSignerFromBytes,
  KeyPairSigner,
} from "@solana/web3.js";

export interface SendTransactionParams<
  TTransaction extends BaseTransactionMessage
> {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  feePayer: TransactionPartialSigner;
  instruction: TTransaction["instructions"][number];
  commitment?: Commitment;
}

export async function sendTransaction<
  TTransaction extends BaseTransactionMessage
>({
  rpc,
  rpcSubscriptions,
  feePayer,
  instruction: instruction,
  commitment = "confirmed",
}: SendTransactionParams<TTransaction>): Promise<void> {
  // Get the latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create the send and confirm transaction factory
  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  // Create the transaction
  const baseTransaction = createTransactionMessage({
    version: 0,
  }) as TTransaction;
  const transactionWithBlockhash = setTransactionMessageLifetimeUsingBlockhash(
    latestBlockhash,
    baseTransaction
  );
  const transactionWithFeePayer = setTransactionMessageFeePayerSigner(
    feePayer,
    transactionWithBlockhash
  );
  const finalTransaction = appendTransactionMessageInstruction(
    instruction,
    transactionWithFeePayer
  );

  // Sign the transaction
  const signedTransaction = await signTransactionMessageWithSigners(
    finalTransaction
  );

  // Send and confirm the transaction
  await sendAndConfirmTransaction(signedTransaction, { commitment });
}

// Code taken from https://solana.com/developers/cookbook/development/load-keypair-from-file
export async function loadDefaultKeypair(): Promise<KeyPairSigner<string>> {
  return await loadKeypairFromFile("~/.config/solana/id.json");
}

export async function loadKeypairFromFile(
  filePath: string
): Promise<KeyPairSigner<string>> {
  // This is here so you can also load the default keypair from the file system.
  const resolvedPath = path.resolve(
    filePath.startsWith("~") ? filePath.replace("~", os.homedir()) : filePath
  );
  const loadedKeyBytes = Uint8Array.from(
    JSON.parse(fs.readFileSync(resolvedPath, "utf8"))
  );
  // Here you can also set the second parameter to true in case you need to extract your private key.
  const keypairSigner = await createKeyPairSignerFromBytes(
    loadedKeyBytes,
    false
  );
  return keypairSigner;
}
