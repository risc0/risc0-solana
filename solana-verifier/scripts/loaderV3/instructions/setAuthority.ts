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
  type ReadonlySignerAccount,
  type TransactionSigner,
  type WritableAccount,
} from '@solana/kit';
import { SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS } from '../programs';
import { getAccountMetaFactory, type ResolvedAccount } from '../shared';

export const SET_AUTHORITY_DISCRIMINATOR = 4;

export function getSetAuthorityDiscriminatorBytes() {
  return getU32Encoder().encode(SET_AUTHORITY_DISCRIMINATOR);
}

export type SetAuthorityInstruction<
  TProgram extends string = typeof SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
  TAccountBufferOrProgramDataAccount extends
    | string
    | IAccountMeta<string> = string,
  TAccountCurrentAuthority extends string | IAccountMeta<string> = string,
  TAccountNewAuthority extends string | IAccountMeta<string> = string,
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountBufferOrProgramDataAccount extends string
        ? WritableAccount<TAccountBufferOrProgramDataAccount>
        : TAccountBufferOrProgramDataAccount,
      TAccountCurrentAuthority extends string
        ? ReadonlySignerAccount<TAccountCurrentAuthority> &
            IAccountSignerMeta<TAccountCurrentAuthority>
        : TAccountCurrentAuthority,
      TAccountNewAuthority extends string
        ? ReadonlyAccount<TAccountNewAuthority>
        : TAccountNewAuthority,
      ...TRemainingAccounts,
    ]
  >;

export type SetAuthorityInstructionData = { discriminator: number };

export type SetAuthorityInstructionDataArgs = {};

export function getSetAuthorityInstructionDataEncoder(): Encoder<SetAuthorityInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([['discriminator', getU32Encoder()]]),
    (value) => ({ ...value, discriminator: SET_AUTHORITY_DISCRIMINATOR })
  );
}

export function getSetAuthorityInstructionDataDecoder(): Decoder<SetAuthorityInstructionData> {
  return getStructDecoder([['discriminator', getU32Decoder()]]);
}

export function getSetAuthorityInstructionDataCodec(): Codec<
  SetAuthorityInstructionDataArgs,
  SetAuthorityInstructionData
> {
  return combineCodec(
    getSetAuthorityInstructionDataEncoder(),
    getSetAuthorityInstructionDataDecoder()
  );
}

export type SetAuthorityInput<
  TAccountBufferOrProgramDataAccount extends string = string,
  TAccountCurrentAuthority extends string = string,
  TAccountNewAuthority extends string = string,
> = {
  /** Buffer or ProgramData account. */
  bufferOrProgramDataAccount: Address<TAccountBufferOrProgramDataAccount>;
  /** Current authority. */
  currentAuthority: TransactionSigner<TAccountCurrentAuthority>;
  /** New authority (optional). */
  newAuthority?: Address<TAccountNewAuthority>;
};

export function getSetAuthorityInstruction<
  TAccountBufferOrProgramDataAccount extends string,
  TAccountCurrentAuthority extends string,
  TAccountNewAuthority extends string,
  TProgramAddress extends
    Address = typeof SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
>(
  input: SetAuthorityInput<
    TAccountBufferOrProgramDataAccount,
    TAccountCurrentAuthority,
    TAccountNewAuthority
  >,
  config?: { programAddress?: TProgramAddress }
): SetAuthorityInstruction<
  TProgramAddress,
  TAccountBufferOrProgramDataAccount,
  TAccountCurrentAuthority,
  TAccountNewAuthority
> {
  // Program address.
  const programAddress =
    config?.programAddress ?? SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    bufferOrProgramDataAccount: {
      value: input.bufferOrProgramDataAccount ?? null,
      isWritable: true,
    },
    currentAuthority: {
      value: input.currentAuthority ?? null,
      isWritable: false,
    },
    newAuthority: { value: input.newAuthority ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.bufferOrProgramDataAccount),
      getAccountMeta(accounts.currentAuthority),
      getAccountMeta(accounts.newAuthority),
    ],
    programAddress,
    data: getSetAuthorityInstructionDataEncoder().encode({}),
  } as SetAuthorityInstruction<
    TProgramAddress,
    TAccountBufferOrProgramDataAccount,
    TAccountCurrentAuthority,
    TAccountNewAuthority
  >;

  return instruction;
}

export type ParsedSetAuthorityInstruction<
  TProgram extends string = typeof SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** Buffer or ProgramData account. */
    bufferOrProgramDataAccount: TAccountMetas[0];
    /** Current authority. */
    currentAuthority: TAccountMetas[1];
    /** New authority (optional). */
    newAuthority?: TAccountMetas[2] | undefined;
  };
  data: SetAuthorityInstructionData;
};

export function parseSetAuthorityInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedSetAuthorityInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 3) {
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
      bufferOrProgramDataAccount: getNextAccount(),
      currentAuthority: getNextAccount(),
      newAuthority: getNextOptionalAccount(),
    },
    data: getSetAuthorityInstructionDataDecoder().decode(instruction.data),
  };
}
