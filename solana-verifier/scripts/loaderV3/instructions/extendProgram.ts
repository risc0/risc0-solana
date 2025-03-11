/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  combineCodec,
  getStructDecoder,
  getStructEncoder,
  getU32Decoder,
  getU32Encoder,
  transformEncoder,
  type Address,
  type Codec,
  type Decoder,
  type Encoder,
  type IAccountMeta,
  type IAccountSignerMeta,
  type IInstruction,
  type IInstructionWithAccounts,
  type IInstructionWithData,
  type ReadonlyAccount,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/kit';
import { SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export const EXTEND_PROGRAM_DISCRIMINATOR = 6;

export function getExtendProgramDiscriminatorBytes() {
  return getU32Encoder().encode(EXTEND_PROGRAM_DISCRIMINATOR);
}

export type ExtendProgramInstruction<
  TProgram extends string = typeof SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
  TAccountProgramDataAccount extends string | IAccountMeta<string> = string,
  TAccountProgramAccount extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends string | IAccountMeta<string> = string,
  TAccountPayer extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountProgramDataAccount extends string
        ? WritableAccount<TAccountProgramDataAccount>
        : TAccountProgramDataAccount,
      TAccountProgramAccount extends string
        ? WritableAccount<TAccountProgramAccount>
        : TAccountProgramAccount,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      TAccountPayer extends string
        ? WritableSignerAccount<TAccountPayer> &
            IAccountSignerMeta<TAccountPayer>
        : TAccountPayer,
      ...TRemainingAccounts,
    ]
  >;

export type ExtendProgramInstructionData = {
  discriminator: number;
  additionalBytes: number;
};

export type ExtendProgramInstructionDataArgs = { additionalBytes: number };

export function getExtendProgramInstructionDataEncoder(): Encoder<ExtendProgramInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', getU32Encoder()],
      ['additionalBytes', getU32Encoder()],
    ]),
    (value) => ({ ...value, discriminator: EXTEND_PROGRAM_DISCRIMINATOR })
  );
}

export function getExtendProgramInstructionDataDecoder(): Decoder<ExtendProgramInstructionData> {
  return getStructDecoder([
    ['discriminator', getU32Decoder()],
    ['additionalBytes', getU32Decoder()],
  ]);
}

export function getExtendProgramInstructionDataCodec(): Codec<
  ExtendProgramInstructionDataArgs,
  ExtendProgramInstructionData
> {
  return combineCodec(
    getExtendProgramInstructionDataEncoder(),
    getExtendProgramInstructionDataDecoder()
  );
}

export type ExtendProgramInput<
  TAccountProgramDataAccount extends string = string,
  TAccountProgramAccount extends string = string,
  TAccountSystemProgram extends string = string,
  TAccountPayer extends string = string,
> = {
  /** ProgramData account. */
  programDataAccount: Address<TAccountProgramDataAccount>;
  /** Program account. */
  programAccount: Address<TAccountProgramAccount>;
  /** System program (optional). */
  systemProgram?: Address<TAccountSystemProgram>;
  /** Payer. */
  payer?: TransactionSigner<TAccountPayer>;
  additionalBytes: ExtendProgramInstructionDataArgs['additionalBytes'];
};

export function getExtendProgramInstruction<
  TAccountProgramDataAccount extends string,
  TAccountProgramAccount extends string,
  TAccountSystemProgram extends string,
  TAccountPayer extends string,
  TProgramAddress extends
    Address = typeof SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
>(
  input: ExtendProgramInput<
    TAccountProgramDataAccount,
    TAccountProgramAccount,
    TAccountSystemProgram,
    TAccountPayer
  >,
  config?: { programAddress?: TProgramAddress }
): ExtendProgramInstruction<
  TProgramAddress,
  TAccountProgramDataAccount,
  TAccountProgramAccount,
  TAccountSystemProgram,
  TAccountPayer
> {
  // Program address.
  const programAddress =
    config?.programAddress ?? SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    programDataAccount: {
      value: input.programDataAccount ?? null,
      isWritable: true,
    },
    programAccount: { value: input.programAccount ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
    payer: { value: input.payer ?? null, isWritable: true },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.programDataAccount),
      getAccountMeta(accounts.programAccount),
      getAccountMeta(accounts.systemProgram),
      getAccountMeta(accounts.payer),
    ],
    programAddress,
    data: getExtendProgramInstructionDataEncoder().encode(
      args as ExtendProgramInstructionDataArgs
    ),
  } as ExtendProgramInstruction<
    TProgramAddress,
    TAccountProgramDataAccount,
    TAccountProgramAccount,
    TAccountSystemProgram,
    TAccountPayer
  >;

  return instruction;
}

export type ParsedExtendProgramInstruction<
  TProgram extends string = typeof SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** ProgramData account. */
    programDataAccount: TAccountMetas[0];
    /** Program account. */
    programAccount: TAccountMetas[1];
    /** System program (optional). */
    systemProgram?: TAccountMetas[2] | undefined;
    /** Payer. */
    payer?: TAccountMetas[3] | undefined;
  };
  data: ExtendProgramInstructionData;
};

export function parseExtendProgramInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedExtendProgramInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 4) {
    // TODO: Coded error.
    throw new Error('Not enough accounts');
  }
  let accountIndex = 0;
  const getNextAccount = () => {
    const accountMeta = instruction.accounts![accountIndex]!;
    accountIndex += 1;
    return accountMeta;
  };
  const getNextOptionalAccount = () => {
    const accountMeta = getNextAccount();
    return accountMeta.address === SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS
      ? undefined
      : accountMeta;
  };
  return {
    programAddress: instruction.programAddress,
    accounts: {
      programDataAccount: getNextAccount(),
      programAccount: getNextAccount(),
      systemProgram: getNextOptionalAccount(),
      payer: getNextOptionalAccount(),
    },
    data: getExtendProgramInstructionDataDecoder().decode(instruction.data),
  };
}
