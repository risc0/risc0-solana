/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  assertAccountExists,
  assertAccountsExist,
  combineCodec,
  decodeAccount,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  fixDecoderSize,
  fixEncoderSize,
  getAddressDecoder,
  getAddressEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  transformEncoder,
  type Account,
  type Address,
  type Codec,
  type Decoder,
  type EncodedAccount,
  type Encoder,
  type FetchAccountConfig,
  type FetchAccountsConfig,
  type MaybeAccount,
  type MaybeEncodedAccount,
  type ReadonlyUint8Array,
} from '@solana/kit';

export const VERIFIER_ENTRY_DISCRIMINATOR = new Uint8Array([
  102, 247, 148, 158, 33, 153, 100, 93,
]);

export function getVerifierEntryDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    VERIFIER_ENTRY_DISCRIMINATOR
  );
}

export type VerifierEntry = {
  discriminator: ReadonlyUint8Array;
  selector: number;
  verifier: Address;
};

export type VerifierEntryArgs = { selector: number; verifier: Address };

export function getVerifierEntryEncoder(): Encoder<VerifierEntryArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['selector', getU32Encoder()],
      ['verifier', getAddressEncoder()],
    ]),
    (value) => ({ ...value, discriminator: VERIFIER_ENTRY_DISCRIMINATOR })
  );
}

export function getVerifierEntryDecoder(): Decoder<VerifierEntry> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['selector', getU32Decoder()],
    ['verifier', getAddressDecoder()],
  ]);
}

export function getVerifierEntryCodec(): Codec<
  VerifierEntryArgs,
  VerifierEntry
> {
  return combineCodec(getVerifierEntryEncoder(), getVerifierEntryDecoder());
}

export function decodeVerifierEntry<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress>
): Account<VerifierEntry, TAddress>;
export function decodeVerifierEntry<TAddress extends string = string>(
  encodedAccount: MaybeEncodedAccount<TAddress>
): MaybeAccount<VerifierEntry, TAddress>;
export function decodeVerifierEntry<TAddress extends string = string>(
  encodedAccount: EncodedAccount<TAddress> | MaybeEncodedAccount<TAddress>
): Account<VerifierEntry, TAddress> | MaybeAccount<VerifierEntry, TAddress> {
  return decodeAccount(
    encodedAccount as MaybeEncodedAccount<TAddress>,
    getVerifierEntryDecoder()
  );
}

export async function fetchVerifierEntry<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<Account<VerifierEntry, TAddress>> {
  const maybeAccount = await fetchMaybeVerifierEntry(rpc, address, config);
  assertAccountExists(maybeAccount);
  return maybeAccount;
}

export async function fetchMaybeVerifierEntry<TAddress extends string = string>(
  rpc: Parameters<typeof fetchEncodedAccount>[0],
  address: Address<TAddress>,
  config?: FetchAccountConfig
): Promise<MaybeAccount<VerifierEntry, TAddress>> {
  const maybeAccount = await fetchEncodedAccount(rpc, address, config);
  return decodeVerifierEntry(maybeAccount);
}

export async function fetchAllVerifierEntry(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<Account<VerifierEntry>[]> {
  const maybeAccounts = await fetchAllMaybeVerifierEntry(
    rpc,
    addresses,
    config
  );
  assertAccountsExist(maybeAccounts);
  return maybeAccounts;
}

export async function fetchAllMaybeVerifierEntry(
  rpc: Parameters<typeof fetchEncodedAccounts>[0],
  addresses: Array<Address>,
  config?: FetchAccountsConfig
): Promise<MaybeAccount<VerifierEntry>[]> {
  const maybeAccounts = await fetchEncodedAccounts(rpc, addresses, config);
  return maybeAccounts.map((maybeAccount) => decodeVerifierEntry(maybeAccount));
}

export function getVerifierEntrySize(): number {
  return 44;
}
