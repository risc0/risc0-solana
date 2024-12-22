import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import { Logger } from "tslog";

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
  Address,
  address,
  createSolanaRpcApi,
  RpcFromTransport,
  RpcTransport,
  SolanaRpcApiFromTransport,
  RpcSubscriptionsFromTransport,
  RpcSubscriptionsTransport,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  TransactionSigner,
  getAddressCodec,
  getProgramDerivedAddress,
  ProgramDerivedAddressBump,
  getU32Codec,
  Lamports,
  lamports,
} from "@solana/web3.js";
import {
  getSetAuthorityInstruction,
  SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
} from "../loaderV3";
import { VERIFIER_ROUTER_PROGRAM_ADDRESS } from "../verify-router";
import { GROTH16_VERIFIER_PROGRAM_ADDRESS } from "../groth16";
import Decimal from "decimal.js";
import {
  FireblocksConfig,
  FireblocksCredentials,
  FireblocksSolanaCluster,
  getFireblocksSigner,
  parseBasePath,
} from "./fireblocksSigner";
import { FireblocksConnectionAdapterConfig } from "solana_fireblocks_web3_provider/src/types";

dotenv.config();
const logger = new Logger();

export enum Programs {
  VerifierRouter = "verifier_router",
  Groth16Verifier = "groth_16_verifier",
  TestBadVerifier = "test_bad_verifier",
}

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export interface SendTransactionParams<
  TTransaction extends BaseTransactionMessage
> {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  feePayer: TransactionPartialSigner | TransactionSigner;
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

// TODO: Optional Extra bit
// // Of course the IDL generated for the LoaderV3 wolud not have any state data
// // to parse ProgramData accounts, lets do it manually...
// export async function getProgramData(rpc: Rpc<SolanaRpcApi>, rpcSubscriptions: RpcSubscriptions<SolanaRpcApi>, programDataAddress: Address<string>) {
//   getAccount
// }

// export async function getAuthority(
//   rpc: Rpc<SolanaRpcApi>,
//   rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
//   programAddress: Address<string>
// ): Promise<Address<string>> {
//   logger.trace(
//     `Fetching the current authority for the program at address: ${programAddress}`
//   );
//   const programDataAddress = await getProgramDataAddress(programAddress);

//   logger.trace(
//     `Using ${programDataAddress} as the address for authority lookup`
//   );

// }

export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export async function changeAuthority(
  rpc: Rpc<SolanaRpcApi>,
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
  programAddress: Address<string>,
  currentAuthority: TransactionSigner,
  newAuthority: Address<string>
): Promise<void> {
  logger.info(
    `Attempting to set the Upgrade Authority of ${programAddress} to ${newAuthority}`
  );
  const programData = await getProgramDataAddress(programAddress);
  logger.debug(
    `Program: ${programAddress} has ProgramData Account Address of ${programData.address} with Bump: ${programData.bump}`
  );
  const setAuthorityInstruction = getSetAuthorityInstruction({
    currentAuthority,
    newAuthority,
    bufferOrProgramDataAccount: programData.address,
  });

  logger.info("Attempting to submit the Upgrade Authority Transaction");

  await sendTransaction({
    rpc,
    rpcSubscriptions,
    feePayer: currentAuthority,
    instruction: setAuthorityInstruction,
    commitment: "confirmed",
  });

  logger.info("Transaction confirmed, upgrade authority changed");
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
    JSON.parse(await fs.promises.readFile(resolvedPath, "utf8"))
  );
  // Here you can also set the second parameter to true in case you need to extract your private key.
  const keypairSigner = await createKeyPairSignerFromBytes(
    loadedKeyBytes,
    false
  );
  return keypairSigner;
}
export interface PDA {
  address: Address<string>;
  bump: ProgramDerivedAddressBump;
}

export async function getRouterPda(
  routerAddress: Address<string>
): Promise<PDA> {
  const pda = await getProgramDerivedAddress({
    programAddress: routerAddress,
    seeds: ["router"],
  });
  return {
    address: pda[0],
    bump: pda[1],
  };
}

export async function getVerifierEntryPda(
  routerAddress: Address<string>,
  selector: number
): Promise<PDA> {
  const routerPda = await getRouterPda(routerAddress);
  const selectorSeed = getU32Codec().encode(selector);
  const pda = await getProgramDerivedAddress({
    programAddress: routerAddress,
    seeds: ["verifier", selectorSeed],
  });
  return {
    address: pda[0],
    bump: pda[1],
  };
}

export async function getProgramDataAddress(
  programAddress: Address<string>
): Promise<PDA> {
  const programAddressSeed = getAddressCodec().encode(programAddress);
  const pda = await getProgramDerivedAddress({
    programAddress: SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
    seeds: [programAddressSeed],
  });
  return {
    address: pda[0],
    bump: pda[1],
  };
}

export async function getLocalKeypair(): Promise<KeyPairSigner<string>> {
  const keyfile = process.env.KEY_PAIR_FILE;
  if (keyfile) {
    return loadKeypairFromFile(keyfile);
  }
  return loadDefaultKeypair();
}

export async function getTransactionSigner(): Promise<TransactionSigner> {
  if (usingFireblocks()) {
    const signer = await getFireblocksSigner();
    if (signer !== null) {
      return signer;
    }
  }
  return await getLocalKeypair();
}

export function getRouterAddress(): Address<string> {
  const router_env = process.env.ROUTER_ADDRESS;
  if (router_env) {
    return address(router_env);
  }
  logger.debug(
    `ROUTER_ADDRESS not set, using address: ${VERIFIER_ROUTER_PROGRAM_ADDRESS}`
  );
  return VERIFIER_ROUTER_PROGRAM_ADDRESS;
}

export function getVerifierAddress(): Address<string> {
  const verifier_env = process.env.VERIFIER_ADDRESS;
  if (verifier_env) {
    return address(verifier_env);
  }
  logger.debug(
    `VERIFIER_ADDRESS not set, using Groth16 Address: ${GROTH16_VERIFIER_PROGRAM_ADDRESS}`
  );
  return GROTH16_VERIFIER_PROGRAM_ADDRESS;
}

export function getNewOwnerAddress(): Address<string> {
  const newOwner_env = process.env.NEW_OWNER;
  if (!newOwner_env) {
    logger.fatal(
      "NEW_OWNER address is not defined and script required this variable to continue"
    );
  }
  return address(newOwner_env);
}

export async function loadOwnerAddress(): Promise<Address<string>> {
  const owner = process.env.ROUTER_OWNER;
  if (owner) {
    return address(owner);
  }
  logger.debug(`Owner variable not set, using local keypair`);
  const keypair = await getLocalKeypair();
  return keypair.address;
}

function floatMulSol(float: number, value: bigint): bigint {
  const floatDecimal = new Decimal(float);
  const valueDecimal = new Decimal(value.toString());
  const rawResult = valueDecimal.mul(floatDecimal);
  const roundedResult = rawResult.toFixed(0);
  return BigInt(roundedResult);
}

export function loadMinimumDeployBalance(): Lamports {
  const balance_env = process.env.MINIMUM_DEPLOY_BALANCE;
  const balance = parseFloat(balance_env) || 6;
  return lamports(floatMulSol(balance, LAMPORTS_PER_SOL));
}

export function loadMinimumScriptBalance(): Lamports {
  const balance_env = process.env.MINIMUM_BALANCE;
  const balance = parseFloat(balance_env) || 1;
  return lamports(floatMulSol(balance, LAMPORTS_PER_SOL));
}

export function usingFireblocks(): boolean {
  return getFireblocksCredentials() !== null;
}

export function getSolanaCluster(): FireblocksSolanaCluster {
  const cluster_env = process.env.SOLANA_CLUSTER.toLowerCase();
  switch (cluster_env) {
    case "testnet":
    case "mainnet-beta":
    case "devnet":
      return cluster_env;
    default:
      logger.warn(
        "SOLANA_CLUSTER environment variable not set, defaulting to devnet."
      );
      return "devnet";
  }
}

export async function getFireblocksCredentials(): Promise<FireblocksConfig | null> {
  const apiSecretPath = process.env.FIREBLOCKS_PRIVATE_KEY_PATH;
  const apiKey = process.env.FIREBLOCKS_API_KEY;
  const basePath_env = process.env.FIREBLOCKS_BASE_PATH;
  const assetId = process.env.FIREBLOCKS_ASSET_ID || "SOL_TEST";
  const vaultAccountId = process.env.FIREBLOCKS_VAULT;
  const basePath = parseBasePath(basePath_env);
  if (!apiSecretPath || !apiKey || !vaultAccountId) {
    logger.warn("FIREBLOCKS VARIABLES USED BUT NOT ALL WHERE INCLUDED:");
    if (!apiSecretPath) {
      logger.warn(
        "Missing FIREBLOCKS_PRIVATE_KEY_PATH environment variable, please make sure its set"
      );
    }
    if (!apiKey) {
      logger.warn(
        "Missing FIREBLOCKS_API_KEY environment variable, please make sure its set"
      );
    }
    if (!vaultAccountId) {
      logger.warn(
        "Missing FIREBLOCKS_VAULT environment variable, please make sure its set"
      );
    }
    return null;
  }
  if (!basePath_env) {
    logger.warn(
      "Missing FIREBLOCKS_BASE_PATH environment variable, defaulting to sandbox"
    );
    if (!process.env.FIREBLOCKS_ASSET_ID) {
      logger.warn(
        "Missing FIREBLOCKS_ASSET_ID environment variable, defaulting to SOL_TEST"
      );
    }
  }

  let apiSecret: string;
  try {
    const secretResolvedPath = path.resolve(
      apiSecretPath.startsWith("~")
        ? apiSecretPath.replace("~", os.homedir())
        : apiSecretPath
    );
    apiSecret = await fs.promises.readFile(secretResolvedPath, "utf8");
  } catch (error) {
    logger.error(
      `Was unable to read Fireblocks Secret Key at path: ${apiSecretPath}`
    );
    logger.error(error);
    return null;
  }

  return {
    apiSecret,
    assetId,
    apiKey,
    basePath,
    vaultAccountId,
  };
}

export function verifiable(): boolean {
  const verifiable_env = process.env.VERIFIABLE;
  if (verifiable_env === undefined) {
    logger.debug("Verifiable builds not set, defaulting to false.");
    return false;
  }
  const verifiable = parseBoolean(verifiable_env);
  logger.debug(`Verifiable Builds: ${verifiable}`);
  return verifiable;
}

export interface SolanaRpcInformation {
  rpc: RpcFromTransport<SolanaRpcApiFromTransport<RpcTransport>, RpcTransport>;
  rpc_subscription: RpcSubscriptionsFromTransport<
    SolanaRpcSubscriptionsApi,
    RpcSubscriptionsTransport
  >;
}

function parseBoolean(value: string): boolean {
  if (!value) {
    return false;
  }
  return ["true", "on", "yes"].includes(value.toLowerCase());
}

export function createRpc(): SolanaRpcInformation {
  const rpcAddress = process.env.RPC || "http://localhost:8899";
  const subscriptionAddress =
    process.env.RPC_SUBSCRIPTION || "ws://localhost:8900";
  return {
    rpc: createSolanaRpc(rpcAddress),
    rpc_subscription: createSolanaRpcSubscriptions(subscriptionAddress),
  };
}
