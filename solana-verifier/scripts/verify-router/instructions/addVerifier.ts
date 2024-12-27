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
  getAddressEncoder,
  getBytesDecoder,
  getBytesEncoder,
  getProgramDerivedAddress,
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
  type ReadonlyUint8Array,
  type TransactionSigner,
  type WritableAccount,
  type WritableSignerAccount,
} from '@solana/web3.js';
import { VERIFIER_ROUTER_PROGRAM_ADDRESS } from '../programs';
import {
  expectAddress,
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';

export const ADD_VERIFIER_DISCRIMINATOR = new Uint8Array([
  165, 72, 135, 225, 67, 181, 255, 135,
]);

export function getAddVerifierDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    ADD_VERIFIER_DISCRIMINATOR
  );
}

export type AddVerifierInstruction<
  TProgram extends string = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
  TAccountRouter extends string | IAccountMeta<string> = string,
  TAccountVerifierEntry extends string | IAccountMeta<string> = string,
  TAccountVerifierProgramData extends string | IAccountMeta<string> = string,
  TAccountVerifierProgram extends string | IAccountMeta<string> = string,
  TAccountAuthority extends string | IAccountMeta<string> = string,
  TAccountSystemProgram extends
    | string
    | IAccountMeta<string> = '11111111111111111111111111111111',
  TRemainingAccounts extends readonly IAccountMeta<string>[] = [],
> = IInstruction<TProgram> &
  IInstructionWithData<Uint8Array> &
  IInstructionWithAccounts<
    [
      TAccountRouter extends string
        ? WritableAccount<TAccountRouter>
        : TAccountRouter,
      TAccountVerifierEntry extends string
        ? WritableAccount<TAccountVerifierEntry>
        : TAccountVerifierEntry,
      TAccountVerifierProgramData extends string
        ? ReadonlyAccount<TAccountVerifierProgramData>
        : TAccountVerifierProgramData,
      TAccountVerifierProgram extends string
        ? ReadonlyAccount<TAccountVerifierProgram>
        : TAccountVerifierProgram,
      TAccountAuthority extends string
        ? WritableSignerAccount<TAccountAuthority> &
            IAccountSignerMeta<TAccountAuthority>
        : TAccountAuthority,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type AddVerifierInstructionData = {
  discriminator: ReadonlyUint8Array;
  selector: number;
};

export type AddVerifierInstructionDataArgs = { selector: number };

export function getAddVerifierInstructionDataEncoder(): Encoder<AddVerifierInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['selector', getU32Encoder()],
    ]),
    (value) => ({ ...value, discriminator: ADD_VERIFIER_DISCRIMINATOR })
  );
}

export function getAddVerifierInstructionDataDecoder(): Decoder<AddVerifierInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['selector', getU32Decoder()],
  ]);
}

export function getAddVerifierInstructionDataCodec(): Codec<
  AddVerifierInstructionDataArgs,
  AddVerifierInstructionData
> {
  return combineCodec(
    getAddVerifierInstructionDataEncoder(),
    getAddVerifierInstructionDataDecoder()
  );
}

export type AddVerifierAsyncInput<
  TAccountRouter extends string = string,
  TAccountVerifierEntry extends string = string,
  TAccountVerifierProgramData extends string = string,
  TAccountVerifierProgram extends string = string,
  TAccountAuthority extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The router account PDA managing verifiers and required Upgrade Authority address of verifier */
  router?: Address<TAccountRouter>;
  /** The new verifier entry to be created which must have a selector in sequential order */
  verifierEntry?: Address<TAccountVerifierEntry>;
  /** Program data account (Data of account authority from LoaderV3) of the verifier being added */
  verifierProgramData?: Address<TAccountVerifierProgramData>;
  /**
   * The program executable code account of the verifier program to be added
   * Must be an unchecked account because any program ID can be here
   */
  verifierProgram: Address<TAccountVerifierProgram>;
  /** The owner of the router which must sign this transaction */
  authority: TransactionSigner<TAccountAuthority>;
  /** Required for account initialization */
  systemProgram?: Address<TAccountSystemProgram>;
  selector: AddVerifierInstructionDataArgs['selector'];
};

export async function getAddVerifierInstructionAsync<
  TAccountRouter extends string,
  TAccountVerifierEntry extends string,
  TAccountVerifierProgramData extends string,
  TAccountVerifierProgram extends string,
  TAccountAuthority extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
>(
  input: AddVerifierAsyncInput<
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountVerifierProgramData,
    TAccountVerifierProgram,
    TAccountAuthority,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): Promise<
  AddVerifierInstruction<
    TProgramAddress,
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountVerifierProgramData,
    TAccountVerifierProgram,
    TAccountAuthority,
    TAccountSystemProgram
  >
> {
  // Program address.
  const programAddress =
    config?.programAddress ?? VERIFIER_ROUTER_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    router: { value: input.router ?? null, isWritable: true },
    verifierEntry: { value: input.verifierEntry ?? null, isWritable: true },
    verifierProgramData: {
      value: input.verifierProgramData ?? null,
      isWritable: false,
    },
    verifierProgram: {
      value: input.verifierProgram ?? null,
      isWritable: false,
    },
    authority: { value: input.authority ?? null, isWritable: true },
    systemProgram: { value: input.systemProgram ?? null, isWritable: false },
  };
  const accounts = originalAccounts as Record<
    keyof typeof originalAccounts,
    ResolvedAccount
  >;

  // Original args.
  const args = { ...input };

  // Resolve default values.
  if (!accounts.router.value) {
    accounts.router.value = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        getBytesEncoder().encode(
          new Uint8Array([114, 111, 117, 116, 101, 114])
        ),
      ],
    });
  }
  if (!accounts.verifierEntry.value) {
    accounts.verifierEntry.value = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        getBytesEncoder().encode(
          new Uint8Array([118, 101, 114, 105, 102, 105, 101, 114])
        ),
        getU32Encoder().encode(expectSome(args.selector)),
      ],
    });
  }
  if (!accounts.verifierProgramData.value) {
    accounts.verifierProgramData.value = await getProgramDerivedAddress({
      programAddress,
      seeds: [
        getAddressEncoder().encode(
          expectAddress(accounts.verifierProgram.value)
        ),
      ],
    });
  }
  if (!accounts.systemProgram.value) {
    accounts.systemProgram.value =
      '11111111111111111111111111111111' as Address<'11111111111111111111111111111111'>;
  }

  const getAccountMeta = getAccountMetaFactory(programAddress, 'programId');
  const instruction = {
    accounts: [
      getAccountMeta(accounts.router),
      getAccountMeta(accounts.verifierEntry),
      getAccountMeta(accounts.verifierProgramData),
      getAccountMeta(accounts.verifierProgram),
      getAccountMeta(accounts.authority),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getAddVerifierInstructionDataEncoder().encode(
      args as AddVerifierInstructionDataArgs
    ),
  } as AddVerifierInstruction<
    TProgramAddress,
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountVerifierProgramData,
    TAccountVerifierProgram,
    TAccountAuthority,
    TAccountSystemProgram
  >;

  return instruction;
}

export type AddVerifierInput<
  TAccountRouter extends string = string,
  TAccountVerifierEntry extends string = string,
  TAccountVerifierProgramData extends string = string,
  TAccountVerifierProgram extends string = string,
  TAccountAuthority extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The router account PDA managing verifiers and required Upgrade Authority address of verifier */
  router: Address<TAccountRouter>;
  /** The new verifier entry to be created which must have a selector in sequential order */
  verifierEntry: Address<TAccountVerifierEntry>;
  /** Program data account (Data of account authority from LoaderV3) of the verifier being added */
  verifierProgramData: Address<TAccountVerifierProgramData>;
  /**
   * The program executable code account of the verifier program to be added
   * Must be an unchecked account because any program ID can be here
   */
  verifierProgram: Address<TAccountVerifierProgram>;
  /** The owner of the router which must sign this transaction */
  authority: TransactionSigner<TAccountAuthority>;
  /** Required for account initialization */
  systemProgram?: Address<TAccountSystemProgram>;
  selector: AddVerifierInstructionDataArgs['selector'];
};

export function getAddVerifierInstruction<
  TAccountRouter extends string,
  TAccountVerifierEntry extends string,
  TAccountVerifierProgramData extends string,
  TAccountVerifierProgram extends string,
  TAccountAuthority extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
>(
  input: AddVerifierInput<
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountVerifierProgramData,
    TAccountVerifierProgram,
    TAccountAuthority,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): AddVerifierInstruction<
  TProgramAddress,
  TAccountRouter,
  TAccountVerifierEntry,
  TAccountVerifierProgramData,
  TAccountVerifierProgram,
  TAccountAuthority,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress =
    config?.programAddress ?? VERIFIER_ROUTER_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    router: { value: input.router ?? null, isWritable: true },
    verifierEntry: { value: input.verifierEntry ?? null, isWritable: true },
    verifierProgramData: {
      value: input.verifierProgramData ?? null,
      isWritable: false,
    },
    verifierProgram: {
      value: input.verifierProgram ?? null,
      isWritable: false,
    },
    authority: { value: input.authority ?? null, isWritable: true },
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
    accounts: [
      getAccountMeta(accounts.router),
      getAccountMeta(accounts.verifierEntry),
      getAccountMeta(accounts.verifierProgramData),
      getAccountMeta(accounts.verifierProgram),
      getAccountMeta(accounts.authority),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getAddVerifierInstructionDataEncoder().encode(
      args as AddVerifierInstructionDataArgs
    ),
  } as AddVerifierInstruction<
    TProgramAddress,
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountVerifierProgramData,
    TAccountVerifierProgram,
    TAccountAuthority,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedAddVerifierInstruction<
  TProgram extends string = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The router account PDA managing verifiers and required Upgrade Authority address of verifier */
    router: TAccountMetas[0];
    /** The new verifier entry to be created which must have a selector in sequential order */
    verifierEntry: TAccountMetas[1];
    /** Program data account (Data of account authority from LoaderV3) of the verifier being added */
    verifierProgramData: TAccountMetas[2];
    /**
     * The program executable code account of the verifier program to be added
     * Must be an unchecked account because any program ID can be here
     */

    verifierProgram: TAccountMetas[3];
    /** The owner of the router which must sign this transaction */
    authority: TAccountMetas[4];
    /** Required for account initialization */
    systemProgram: TAccountMetas[5];
  };
  data: AddVerifierInstructionData;
};

export function parseAddVerifierInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedAddVerifierInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 6) {
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
      router: getNextAccount(),
      verifierEntry: getNextAccount(),
      verifierProgramData: getNextAccount(),
      verifierProgram: getNextAccount(),
      authority: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getAddVerifierInstructionDataDecoder().decode(instruction.data),
  };
}
