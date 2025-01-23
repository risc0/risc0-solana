// import { Fireblocks, BasePath } from "@fireblocks/ts-sdk";
import {
  MessagePartialSigner,
  TransactionPartialSigner,
} from "@solana/signers";
import {
  createLogger,
  getFireblocksCredentials,
  sleep,
  usingFireblocks,
} from "./utils";
import { address } from "@solana/addresses";
import {
  BasePath,
  CreateTransactionResponse,
  Fireblocks,
  TransactionOperation,
  TransactionResponse,
  TransactionStateEnum,
} from "@fireblocks/ts-sdk";
import { getBase16Codec, SignatureBytes } from "@solana/web3.js";
import { PeerType } from "fireblocks-sdk";

const logger = createLogger();

export type FireBlocksSigner<TAddress extends string = string> =
  MessagePartialSigner<TAddress> &
    TransactionPartialSigner<TAddress> & {
      fireblocks: Fireblocks;
    };

/**
 * Configuration interface for Fireblocks wallet integration
 *
 * Contains the necessary credentials and parameters for initializing a connection
 * to the Fireblocks API and accessing a specific vault account.
 *
 * @interface
 * @property {string} apiSecret - RSA private key for API authentication
 * @property {string} apiKey - Fireblocks API key for authentication
 * @property {BasePath} basePath - API endpoint (Sandbox/US/EU/EU2)
 * @property {string} assetId - Asset identifier (e.g., "SOL_TEST" for testnet)
 * @property {string} vaultAccountId - ID of the Fireblocks vault account to use
 */
export interface FireblocksConfig {
  apiSecret: string;
  apiKey: string;
  basePath: BasePath;
  assetId: string;
  vaultAccountId: string;
}

/**
 * Converts a string input to a Fireblocks BasePath enum value
 *
 * Maps input strings to the appropriate API endpoint environment.
 * Defaults to Sandbox if the input doesn't match any known environment.
 *
 * @param {string} value - The base path string to parse ("us", "eu", "eu2", "sandbox")
 * @returns {BasePath} The corresponding BasePath enum value
 *
 * @example
 * const path = parseBasePath("us"); // Returns BasePath.US
 * const defaultPath = parseBasePath("invalid"); // Returns BasePath.Sandbox
 */
export function parseBasePath(value: string): BasePath {
  switch (value.toLowerCase()) {
    case "us":
      return BasePath.US;
    case "eu":
      return BasePath.EU;
    case "eu2":
      return BasePath.EU2;
    case "sandbox":
      return BasePath.Sandbox;
    default:
      if (value == "") {
        logger.info(
          "Fireblocks Base Path value was not set, defaulting to sandbox"
        );
      } else {
        logger.warn(
          "Fireblocks Base Path value could not be parsed, defaulting to sandbox"
        );
      }
      return BasePath.Sandbox;
  }
}

/**
 * Creates a Solana message/transaction signer using Fireblocks credentials
 *
 * Initializes a connection to Fireblocks and creates a signer that implements
 * both MessagePartialSigner and TransactionPartialSigner interfaces. The signer
 * uses the Fireblocks API to sign Solana transactions and messages.
 *
 * @param {FireblocksConfig} config - Fireblocks configuration parameters
 * @returns {Promise<FireBlocksSigner>} A signer that can sign Solana transactions and messages
 * @throws If unable to initialize Fireblocks connection or fetch vault addresses
 *
 * @security Handles sensitive signing operations through Fireblocks HSM
 * @security Requires RAW Signing feature which is disabled by fireblocks without contacting them first
 * @see waitForSignature - Internal helper method for polling signature status
 */
export async function createSignerFromFireblocksConfig(
  config: FireblocksConfig
): Promise<FireBlocksSigner> {
  const fireblocks = new Fireblocks({
    apiKey: config.apiKey,
    secretKey: config.apiSecret,
    basePath: config.basePath,
  });

  const depositAddresses =
    await fireblocks.vaults.getVaultAccountAssetAddressesPaginated({
      assetId: config.assetId,
      vaultAccountId: config.vaultAccountId,
    });

  const depositAddress = depositAddresses.data.addresses[0];
  const publicAddress = address(depositAddress.address);

  async function waitForSignature(
    tx: CreateTransactionResponse
  ): Promise<TransactionResponse> {
    let txResponse = await fireblocks.transactions.getTransaction({
      txId: tx.id,
    });
    while (
      txResponse.data.status !== TransactionStateEnum.Completed &&
      txResponse.data.status !== TransactionStateEnum.Broadcasting
    ) {
      await sleep(2000);

      txResponse = await fireblocks.transactions.getTransaction({
        txId: tx.id,
      });
    }
    return txResponse.data;
  }

  return {
    fireblocks,
    address: publicAddress,
    signMessages: async (messages) => {
      logger.silly(`signMessages called, messages: `);
      logger.silly(messages);
      const rawSigner = await fireblocks.transactions.createTransaction({
        transactionRequest: {
          operation: TransactionOperation.Raw,
          source: {
            type: PeerType.VAULT_ACCOUNT,
            id: config.vaultAccountId,
          },
          assetId: config.assetId,
          extraParameters: {
            rawMessageData: {
              messages: messages.map((message) => {
                logger.trace(
                  `Message: ${getBase16Codec().decode(message.content)}`
                );
                return { content: getBase16Codec().decode(message.content) };
              }),
            },
          },
        },
      });
      const signedMessage = await waitForSignature(rawSigner.data);
      logger.trace(`Signed Message Completed:`);
      logger.trace(signedMessage);
      return signedMessage.signedMessages.map((message) => {
        const hexSig = message.signature.fullSig;
        const readOnlyBytes = getBase16Codec().encode(hexSig);
        const signatureBytes = new Uint8Array(readOnlyBytes) as SignatureBytes;
        return Object.freeze({
          [publicAddress]: signatureBytes,
        });
      });
    },
    signTransactions: async (transaction) => {
      logger.silly(`signTransactions called, Transactions: `);
      logger.silly(transaction);
      const rawSigner = await fireblocks.transactions.createTransaction({
        transactionRequest: {
          operation: TransactionOperation.Raw,
          source: {
            type: PeerType.VAULT_ACCOUNT,
            id: config.vaultAccountId,
          },
          assetId: config.assetId,
          extraParameters: {
            rawMessageData: {
              messages: transaction.map((tx) => {
                logger.trace(
                  `Transaction: ${getBase16Codec().decode(tx.messageBytes)}`
                );
                return { content: getBase16Codec().decode(tx.messageBytes) };
              }),
            },
          },
        },
      });
      const signedTransaction = await waitForSignature(rawSigner.data);
      logger.trace(`Signed Transaction Completed:`);
      logger.trace(signedTransaction);
      return signedTransaction.signedMessages.map((message) => {
        const hexSig = message.signature.fullSig;
        const readOnlyBytes = getBase16Codec().encode(hexSig);
        const signatureBytes = new Uint8Array(readOnlyBytes) as SignatureBytes;
        return Object.freeze({
          [publicAddress]: signatureBytes,
        });
      });
    },
  };
}

/**
 * Factory function that creates a Fireblocks signer based on environment configuration
 *
 * Attempts to create a Fireblocks signer using environment variables. Returns null
 * if Fireblocks is not configured or if required configuration is missing.
 *
 * @returns {Promise<FireBlocksSigner | null>} A configured Fireblocks signer or null if
 *                                            Fireblocks is not configured
 * @throws If environment variables exist but are invalid or if connection fails
 *
 * Required environment variables:
 * - FIREBLOCKS_PRIVATE_KEY_PATH
 * - FIREBLOCKS_API_KEY
 * - FIREBLOCKS_VAULT
 *
 * Optional environment variables:
 * - FIREBLOCKS_BASE_PATH (defaults to "sandbox")
 * - FIREBLOCKS_ASSET_ID (defaults to "SOL_TEST")
 */
export async function getFireblocksSigner(): Promise<FireBlocksSigner | null> {
  if (!(await usingFireblocks())) {
    return null;
  }
  logger.info("Something is using the fireblocks signer");
  const config = await getFireblocksCredentials();
  return await createSignerFromFireblocksConfig(config);
}
