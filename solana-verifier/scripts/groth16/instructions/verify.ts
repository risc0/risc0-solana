/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  combineCodec,
  fixDecoderSize,
  fixEncoderSize,
  getArrayDecoder,
  getArrayEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getStructDecoder,
  getStructEncoder,
  getU8Decoder,
  getU8Encoder,
  transformEncoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
  type IAccountMeta,
  type IInstruction,
  type IInstructionWithAccounts,
  type IInstructionWithData,
  type ReadonlyAccount,
  type ReadonlyUint8Array,
} from '@solana/web3.js';
import { GROTH16_VERIFIER_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export const VERIFY_DISCRIMINATOR = new Uint8Array([
  133, 161, 141, 48, 120, 198, 88, 150,
]);

export function getVerifyDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(VERIFY_DISCRIMINATOR);
}

export type VerifyInstruction<
  TProgram extends string = typeof GROTH16_VERIFIER_PROGRAM_ADDRESS,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type VerifyInstructionData = {
  discriminator: ReadonlyUint8Array;
  piA: ReadonlyUint8Array;
  piB: Array<number>;
  piC: ReadonlyUint8Array;
  imageId: ReadonlyUint8Array;
  journalDigest: ReadonlyUint8Array;
};

export type VerifyInstructionDataArgs = {
  piA: ReadonlyUint8Array;
  piB: Array<number>;
  piC: ReadonlyUint8Array;
  imageId: ReadonlyUint8Array;
  journalDigest: ReadonlyUint8Array;
};

export function getVerifyInstructionDataEncoder(): Encoder<VerifyInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['piA', fixEncoderSize(getBytesEncoder(), 64)],
      ['piB', getArrayEncoder(getU8Encoder(), { size: 128 })],
      ['piC', fixEncoderSize(getBytesEncoder(), 64)],
      ['imageId', fixEncoderSize(getBytesEncoder(), 32)],
      ['journalDigest', fixEncoderSize(getBytesEncoder(), 32)],
    ]),
    (value) => ({ ...value, discriminator: VERIFY_DISCRIMINATOR })
  );
}

export function getVerifyInstructionDataDecoder(): Decoder<VerifyInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['piA', fixDecoderSize(getBytesDecoder(), 64)],
    ['piB', getArrayDecoder(getU8Decoder(), { size: 128 })],
    ['piC', fixDecoderSize(getBytesDecoder(), 64)],
    ['imageId', fixDecoderSize(getBytesDecoder(), 32)],
    ['journalDigest', fixDecoderSize(getBytesDecoder(), 32)],
  ]);
}

export function getVerifyInstructionDataCodec(): Codec<
  VerifyInstructionDataArgs,
  VerifyInstructionData
> {
  return combineCodec(
    getVerifyInstructionDataEncoder(),
    getVerifyInstructionDataDecoder()
  );
}

export type VerifyInput<TAccountSystemProgram extends string = string> = {
  systemProgram?: Address<TAccountSystemProgram>;
  piA: VerifyInstructionDataArgs['piA'];
  piB: VerifyInstructionDataArgs['piB'];
  piC: VerifyInstructionDataArgs['piC'];
  imageId: VerifyInstructionDataArgs['imageId'];
  journalDigest: VerifyInstructionDataArgs['journalDigest'];
};

export function getVerifyInstruction<
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof GROTH16_VERIFIER_PROGRAM_ADDRESS,
>(
  input: VerifyInput<TAccountSystemProgram>,
  config?: { programAddress?: TProgramAddress }
): VerifyInstruction<TProgramAddress, TAccountSystemProgram> {
  // Program address.
  const programAddress =
    config?.programAddress ?? GROTH16_VERIFIER_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [getAccountMeta(accounts.systemProgram)],
    programAddress,
    data: getVerifyInstructionDataEncoder().encode(
      args as VerifyInstructionDataArgs
    ),
  } as VerifyInstruction<TProgramAddress, TAccountSystemProgram>;

  return instruction;
}

export type ParsedVerifyInstruction<
  TProgram extends string = typeof GROTH16_VERIFIER_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    systemProgram: TAccountMetas[0];
  };
  data: VerifyInstructionData;
};

export function parseVerifyInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedVerifyInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 1) {
    // TODO: Coded error.
    throw new Error('Not enough accounts');
  }
  let accountIndex = 0;
  const getNextAccount = () => {
    const accountMeta = instruction.accounts![accountIndex]!;
    accountIndex += 1;
    return accountMeta;
  };
  return {
    programAddress: instruction.programAddress,
    accounts: {
      systemProgram: getNextAccount(),
    },
    data: getVerifyInstructionDataDecoder().decode(instruction.data),
  };
}
