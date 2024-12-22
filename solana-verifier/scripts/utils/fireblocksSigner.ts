// import { Fireblocks, BasePath } from "@fireblocks/ts-sdk";
import {
  MessagePartialSigner,
  TransactionPartialSigner,
} from "@solana/signers";
import { getFireblocksCredentials, sleep, usingFireblocks } from "./utils";
import { address } from "@solana/addresses";
// import { ApiBaseUrl } from "solana_fireblocks_web3_provider/src/types";
// import {
//   FireblocksSDK,
//   PeerType,
//   TransactionArguments,
//   TransactionOperation,
// } from "fireblocks-sdk";
import {
  BasePath,
  CreateTransactionResponse,
  Fireblocks,
  TransactionOperation,
  TransactionResponse,
  TransactionStateEnum,
} from "@fireblocks/ts-sdk";
import { getBase58Codec, getBase16Codec } from "@solana/web3.js";
import { Logger } from "tslog";
import { PeerType } from "fireblocks-sdk";

export type FireBlocksSigner<TAddress extends string = string> =
  MessagePartialSigner<TAddress> &
    TransactionPartialSigner<TAddress> & {
      fireblocks: Fireblocks;
    };

export type FireblocksBaseUrl = "testnet" | "mainnet-beta" | "devnet";

const logger = new Logger();

export interface FireblocksConfig {
  apiSecret: string;
  apiKey: string;
  basePath: BasePath;
  assetId: string;
  vaultAccountId: string;
}

export function parseBasePath(value: string): BasePath {
  switch (value.toLowerCase()) {
    case "us":
      return BasePath.US;
    case "eu":
      return BasePath.EU;
    case "eu2":
      return BasePath.EU2;
    case "sandbox":
    default:
      return BasePath.Sandbox;
  }
}

export async function createSignerFromFireblocksConfig(
  config: FireblocksConfig
): Promise<FireBlocksSigner> {
  //   const fireblocksClient = new FireblocksSDK(
  //     config.apiSecret,
  //     config.apiKey,
  //     config.apiBaseUrl
  //   );

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
      return signedMessage.signedMessages.map((message) =>
        Object.freeze({
          [publicAddress]: getBase16Codec().encode(message.signature.fullSig),
        })
      );
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
      return signedTransaction.signedMessages.map((message) =>
        Object.freeze({
          [publicAddress]: getBase16Codec().encode(message.signature.fullSig),
        })
      );
    },
  };
}

export async function getFireblocksSigner(): Promise<FireBlocksSigner | null> {
  if (!usingFireblocks()) {
    return null;
  }
  logger.info("Something is using the fireblocks signer");
  const config = await getFireblocksCredentials();
  return await createSignerFromFireblocksConfig(config);
}
