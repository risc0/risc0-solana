import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";

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
  SolanaRpcSubscriptionsApi,
  Commitment,
  BaseTransactionMessage,
  TransactionPartialSigner,
  createKeyPairSignerFromBytes,
  KeyPairSigner,
  Address,
  address,
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
  ITransactionMessageWithFeePayer,
  TransactionMessageWithBlockhashLifetime,
} from "@solana/kit";
import {
  getSetAuthorityInstruction,
  SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
} from "../loaderV3";
import { VERIFIER_ROUTER_PROGRAM_ADDRESS } from "../verify-router";
import { GROTH16_VERIFIER_PROGRAM_ADDRESS } from "../groth16";
import Decimal from "decimal.js";
import { Logger } from "tslog";

dotenv.config();
const logger = createLogger();

/**
 * Creates a configured logger instance
 *
 * Initializes a logger with the appropriate log level based on environment
 * configuration. Defaults to INFO level if not specified.
 *
 * @returns Configured Logger instance
 */
export function createLogger() {
  const logLevel = process.env.LOG_LEVEL || "info";
  let minLevel: number;
  switch (logLevel.toLowerCase()) {
    case "silly":
      minLevel = 0;
      break;
    case "trace":
      minLevel = 1;
      break;
    case "debug":
      minLevel = 2;
      break;
    case "info":
      minLevel = 3;
      break;
    case "warn":
      minLevel = 4;
      break;
    case "error":
      minLevel = 5;
      break;
    case "fatal":
      minLevel = 6;
      break;
    default:
      // INFO
      minLevel = 3;
      break;
  }
  const logger = new Logger({
    minLevel,
  });
  return logger;
}

import {
  FireblocksConfig,
  getFireblocksSigner,
  parseBasePath,
} from "./fireblocksSigner";

export enum Programs {
  VerifierRouter = "verifier_router",
  Groth16Verifier = "groth_16_verifier",
  TestBadVerifier = "test_bad_verifier",
}

export const LAMPORTS_PER_SOL = 1_000_000_000n;

type BlockhashTransaction = BaseTransactionMessage &
  ITransactionMessageWithFeePayer<string> &
  TransactionMessageWithBlockhashLifetime;

/**
 * Arguments Interface for sending transactions with the sendTransaction
 * utility function
 *
 * @template TTransaction - Type extending BlockhashTransaction
 * @property rpc - Solana RPC client instance
 * @property rpcSubscriptions - Solana RPC subscriptions instance
 * @property feePayer - TransactionSigner that will pay for the transaction
 * @property instruction - Transaction instruction to be executed
 * @property commitment - Optional commitment level for transaction confirmation
 */
export interface SendTransactionParams<
  TTransaction extends BlockhashTransaction,
> {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  feePayer: TransactionPartialSigner | TransactionSigner;
  instruction: TTransaction["instructions"][number];
  commitment?: Commitment;
}

/**
 * Creates and sends a transaction with the provided instruction
 *
 * @template TTransaction - Type extending BlockhashTransaction
 * @param params - Parameters for sending the transaction
 * @returns Promise that resolves when transaction is confirmed
 *
 * # Security Considerations
 * * Requires a valid feePayer with sufficient balance
 * * Uses latest blockhash for transaction lifetime
 */
export async function sendTransaction<
  TTransaction extends BlockhashTransaction,
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
  ) as TTransaction;
  const finalTransaction = appendTransactionMessageInstruction(
    instruction,
    transactionWithFeePayer
  );

  // Sign the transaction
  const signedTransaction =
    await signTransactionMessageWithSigners(finalTransaction);

  // Send and confirm the transaction
  await sendAndConfirmTransaction(signedTransaction, { commitment });
}

/**
 * Utility function to pause execution
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Changes the authority of a program
 *
 * Updates the upgrade authority of a program to a new address. Requires
 * signature from current authority.
 *
 * @param rpc - Solana RPC client instance
 * @param rpcSubscriptions - Solana RPC subscriptions instance
 * @param programAddress - Address of program to modify
 * @param currentAuthority - Current authority TransactionSigner
 * @param newAuthority - New authority address
 *
 * # Security Considerations
 * * Requires TransactionSigner from current authority
 * * Updates program data account authority
 */
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

/**
 * Loads the default Solana keypair
 *
 * Reads the default keypair from ~/.config/solana/id.json
 *
 * @returns KeyPairSigner loaded from default location
 */
export async function loadDefaultKeypair(): Promise<KeyPairSigner<string>> {
  return await loadKeypairFromFile("~/.config/solana/id.json");
}

/**
 * Loads a keypair from a specified file path
 *
 * @param filePath - Path to keypair file
 * @returns KeyPairSigner loaded from file
 */
// Code taken from https://solana.com/developers/cookbook/development/load-keypair-from-file
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

/**
 * Interface representing a Program Derived Address with bump seed
 *
 * @property address - The derived address
 * @property bump - Bump seed used in derivation
 */
export interface PDA {
  address: Address<string>;
  bump: ProgramDerivedAddressBump;
}

/**
 * Derives the router PDA for a given router program
 *
 * @param routerAddress - Address of the router program
 * @returns PDA info containing derived address and bump
 *
 * # Seeds
 * * ["router"]
 */
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

/**
 * Derives the verifier entry PDA for a given selector
 *
 * @param routerAddress - Address of the router program
 * @param selector - Selector number for the verifier
 * @returns PDA info containing derived address and bump
 *
 * # Seeds
 * * ["verifier", selector_bytes]
 */
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

/**
 * Derives the program data address for an upgradeable program
 *
 * @param programAddress - Address of the program
 * @returns PDA info containing derived address and bump
 *
 * # Seeds
 * * [program_address_bytes]
 */
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

/**
 * Gets the local keypair for use in scripts based upon either the environment values
 * or the system default.
 *
 * @note Uses KEY_PAIR_FILE environment variable
 * @returns KeyPairSigner for signing transaction on the local machine
 */
export async function getLocalKeypair(): Promise<KeyPairSigner<string>> {
  const keyfile = process.env.KEY_PAIR_FILE;
  if (keyfile) {
    return loadKeypairFromFile(keyfile);
  }
  return loadDefaultKeypair();
}

/**
 * Gets the configured transaction signer
 *
 * Returns either a Fireblocks signer if configured, or falls back
 * to local keypair.
 *
 * @returns TransactionSigner to use for signing
 */
export async function getTransactionSigner(): Promise<TransactionSigner> {
  if (await usingFireblocks()) {
    const signer = await getFireblocksSigner();
    if (signer !== null) {
      return signer;
    }
  }
  return await getLocalKeypair();
}

/**
 * Gets the router program address from environment or defaults
 *
 * @notice Uses ROUTER_ADDRESS environment variable
 * @returns Address of the router program to use
 */
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

/**
 * Gets the verifier program address from environment or defaults
 * @notice Uses VERIFIER_ADDRESS environment variable
 * @returns Address of the verifier program to use
 */
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

/**
 * Gets the new owner address from environment
 *
 * @returns Address specified as new owner
 * @throws If NEW_OWNER environment variable is not set
 */
export function getNewOwnerAddress(): Address<string> {
  const newOwner_env = process.env.NEW_OWNER;
  if (!newOwner_env) {
    logger.fatal(
      "NEW_OWNER address is not defined and script required this variable to continue"
    );
  }
  return address(newOwner_env);
}

/**
 * Loads the owner address from environment or defaults to the
 * local keypair.
 *
 * @notice Uses ROUTER_OWNER environment variable
 * @returns Address of the owner to use
 */
export async function loadOwnerAddress(): Promise<Address<string>> {
  const owner = process.env.ROUTER_OWNER;
  if (owner) {
    return address(owner);
  }
  logger.debug(`Owner variable not set, using local keypair`);
  const keypair = await getLocalKeypair();
  return keypair.address;
}

/**
 * Multiplies a floating point number with a bigint while maintaining precision
 *
 * Used for accurate SOL calculations by converting to Decimal for the multiplication
 * and then back to bigint. Handles the conversion of SOL amounts to lamports.
 *
 * @param float - Floating point multiplier
 * @param value - Bigint value to multiply
 * @returns Result as bigint with correct precision
 *
 * # Example
 * ```typescript
 * // Convert 1.5 SOL to lamports
 * const lamports = lamports(floatMulSol(1.5, LAMPORTS_PER_SOL))
 * ```
 */
function floatMulSol(float: number, value: bigint): bigint {
  const floatDecimal = new Decimal(float);
  const valueDecimal = new Decimal(value.toString());
  const rawResult = valueDecimal.mul(floatDecimal);
  const roundedResult = rawResult.toFixed(0);
  return BigInt(roundedResult);
}

/**
 * Gets the minimum balance required for deployment
 * defaults to 6 SOL
 *
 * @notice Uses the MINIMUM_DEPLOY_BALANCE environment variable
 * @returns Lamports representing minimum required balance
 */
export function loadMinimumDeployBalance(): Lamports {
  const balance_env = process.env.MINIMUM_DEPLOY_BALANCE;
  const balance = parseFloat(balance_env) || 6;
  return lamports(floatMulSol(balance, LAMPORTS_PER_SOL));
}

/**
 * Gets the minimum balance required for script execution
 * defaults to 1 SOL
 *
 * @notice Uses the MINIMUM_BALANCE environment variable
 * @returns Lamports representing minimum required balance
 */
export function loadMinimumScriptBalance(): Lamports {
  const balance_env = process.env.MINIMUM_BALANCE;
  const balance = parseFloat(balance_env) || 1;
  return lamports(floatMulSol(balance, LAMPORTS_PER_SOL));
}

/**
 * Checks if Fireblocks signing has been configured
 *
 * @returns true if Fireblocks credentials are configured
 */
export async function usingFireblocks(): Promise<boolean> {
  return (await getFireblocksCredentials()) !== null;
}

/**
 * Gets Fireblocks configuration from environment
 * @notice Uses the FIREBLOCKS_PRIVATE_KEY_PATH environment variable
 * @notice Uses the FIREBLOCKS_API_KEY environment variable
 * @notice Uses the FIREBLOCKS_VAULT environment variable
 * @notice Uses the FIREBLOCKS_BASE_PATH *optional* environment variable
 * @notice Uses the FIREBLOCKS_ASSET_ID *optional* environment variable
 * @returns FireblocksConfig if all required variables are set, null otherwise
 */
export async function getFireblocksCredentials(): Promise<FireblocksConfig | null> {
  const apiSecretPath = process.env.FIREBLOCKS_PRIVATE_KEY_PATH;
  const apiKey = process.env.FIREBLOCKS_API_KEY;
  const basePath_env = process.env.FIREBLOCKS_BASE_PATH || "";
  const assetId = process.env.FIREBLOCKS_ASSET_ID || "SOL_TEST";
  const vaultAccountId = process.env.FIREBLOCKS_VAULT;
  // If at least one of the fireblocks credential values are set
  // AND one or more of the required values is not set
  if (!apiSecretPath && !apiKey && !vaultAccountId) {
    return null;
  }
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

/**
 * Checks if verifiable builds are enabled
 *
 * @notice Uses the VERIFIABLE environment variable
 * @returns true if verifiable builds are enabled
 */
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

/**
 * Interface for Solana RPC connections
 *
 * @property rpc - Standard RPC connection
 * @property rpc_subscription - WebSocket subscription connection
 */
export interface SolanaRpcInformation {
  rpc: RpcFromTransport<SolanaRpcApiFromTransport<RpcTransport>, RpcTransport>;
  rpc_subscription: RpcSubscriptionsFromTransport<
    SolanaRpcSubscriptionsApi,
    RpcSubscriptionsTransport
  >;
}

/**
 * Parses a string into a boolean value
 *
 * Converts various string representations to boolean values.
 * Returns true for "true", "on", and "yes" (case-insensitive).
 * Returns false for empty strings or any other values.
 *
 * @param value - String to parse
 * @returns Parsed boolean value
 */
function parseBoolean(value: string): boolean {
  if (!value) {
    return false;
  }
  return ["true", "on", "yes"].includes(value.toLowerCase());
}

/**
 * Creates RPC connections to Solana node
 *
 * Initializes both standard RPC and WebSocket subscription connections
 * using configuration from environment.
 *
 * Defaults to "http://localhost:8899" for the rpc entry and "ws://localhost:8900"
 * for the rpc_subscription address
 *
 *
 * @notice Uses the RPC environment variable
 * @notice Uses the RPC_SUBSCRIPTION environment variable
 * @returns Configured RPC connections
 */
export function createRpc(): SolanaRpcInformation {
  const rpcAddress = process.env.RPC || "http://localhost:8899";
  const subscriptionAddress =
    process.env.RPC_SUBSCRIPTION || "ws://localhost:8900";
  return {
    rpc: createSolanaRpc(rpcAddress),
    rpc_subscription: createSolanaRpcSubscriptions(subscriptionAddress),
  };
}
