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
} from '@solana/kit';
import { VERIFIER_ROUTER_PROGRAM_ADDRESS } from '../programs';
import {
  expectAddress,
  expectSome,
  getAccountMetaFactory,
  type ResolvedAccount,
} from '../shared';
import {
  getProofDecoder,
  getProofEncoder,
  type Proof,
  type ProofArgs,
} from '../types';

export const EMERGENCY_STOP_WITH_PROOF_DISCRIMINATOR = new Uint8Array([
  54, 84, 135, 9, 249, 7, 161, 4,
]);

export function getEmergencyStopWithProofDiscriminatorBytes() {
  return fixEncoderSize(getBytesEncoder(), 8).encode(
    EMERGENCY_STOP_WITH_PROOF_DISCRIMINATOR
  );
}

export type EmergencyStopWithProofInstruction<
  TProgram extends string = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
  TAccountRouter extends string | IAccountMeta<string> = string,
  TAccountVerifierEntry extends string | IAccountMeta<string> = string,
  TAccountAuthority extends string | IAccountMeta<string> = string,
  TAccountVerifierProgram extends string | IAccountMeta<string> = string,
  TAccountVerifierProgramData extends string | IAccountMeta<string> = string,
  TAccountBpfLoaderUpgradableProgram extends
    | string
    | IAccountMeta<string> = string,
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
      TAccountAuthority extends string
        ? WritableSignerAccount<TAccountAuthority> &
            IAccountSignerMeta<TAccountAuthority>
        : TAccountAuthority,
      TAccountVerifierProgram extends string
        ? WritableAccount<TAccountVerifierProgram>
        : TAccountVerifierProgram,
      TAccountVerifierProgramData extends string
        ? WritableAccount<TAccountVerifierProgramData>
        : TAccountVerifierProgramData,
      TAccountBpfLoaderUpgradableProgram extends string
        ? ReadonlyAccount<TAccountBpfLoaderUpgradableProgram>
        : TAccountBpfLoaderUpgradableProgram,
      TAccountSystemProgram extends string
        ? ReadonlyAccount<TAccountSystemProgram>
        : TAccountSystemProgram,
      ...TRemainingAccounts,
    ]
  >;

export type EmergencyStopWithProofInstructionData = {
  discriminator: ReadonlyUint8Array;
  selector: number;
  proof: Proof;
};

export type EmergencyStopWithProofInstructionDataArgs = {
  selector: number;
  proof: ProofArgs;
};

export function getEmergencyStopWithProofInstructionDataEncoder(): Encoder<EmergencyStopWithProofInstructionDataArgs> {
  return transformEncoder(
    getStructEncoder([
      ['discriminator', fixEncoderSize(getBytesEncoder(), 8)],
      ['selector', getU32Encoder()],
      ['proof', getProofEncoder()],
    ]),
    (value) => ({
      ...value,
      discriminator: EMERGENCY_STOP_WITH_PROOF_DISCRIMINATOR,
    })
  );
}

export function getEmergencyStopWithProofInstructionDataDecoder(): Decoder<EmergencyStopWithProofInstructionData> {
  return getStructDecoder([
    ['discriminator', fixDecoderSize(getBytesDecoder(), 8)],
    ['selector', getU32Decoder()],
    ['proof', getProofDecoder()],
  ]);
}

export function getEmergencyStopWithProofInstructionDataCodec(): Codec<
  EmergencyStopWithProofInstructionDataArgs,
  EmergencyStopWithProofInstructionData
> {
  return combineCodec(
    getEmergencyStopWithProofInstructionDataEncoder(),
    getEmergencyStopWithProofInstructionDataDecoder()
  );
}

export type EmergencyStopWithProofAsyncInput<
  TAccountRouter extends string = string,
  TAccountVerifierEntry extends string = string,
  TAccountAuthority extends string = string,
  TAccountVerifierProgram extends string = string,
  TAccountVerifierProgramData extends string = string,
  TAccountBpfLoaderUpgradableProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The router account PDA managing verifiers and required Upgrade Authority address of verifier */
  router?: Address<TAccountRouter>;
  /**
   * The verifier entry of the program to be stopped.
   * This entry will be closed and refunded to the caller on successful stop
   */
  verifierEntry?: Address<TAccountVerifierEntry>;
  /**
   * The authority attempting the emergency stop (either the router owner OR the person presenting proof of exploit)
   * The authority will get the rent refund of both the program account of the verifier and the verifierEntry account
   */
  authority: TransactionSigner<TAccountAuthority>;
  /**
   * The program account of the verifier to be used Address is verified against VerifierEntry
   * Must be Unchecked as there could be any program ID here.
   * This account will be closed by a CPI call to the Loader V3 and rent refunded to the authority
   */
  verifierProgram: Address<TAccountVerifierProgram>;
  /** The Program Data account of the verifier to be closed */
  verifierProgramData?: Address<TAccountVerifierProgramData>;
  /**
   * This is the Loader V3 BPF Upgrade program, Not written in Anchor so we cannot use the
   * CPI extensions to automatically generate a secure CPI call and must do so manually
   */
  bpfLoaderUpgradableProgram: Address<TAccountBpfLoaderUpgradableProgram>;
  /** Required because we are closing accounts */
  systemProgram?: Address<TAccountSystemProgram>;
  selector: EmergencyStopWithProofInstructionDataArgs['selector'];
  proof: EmergencyStopWithProofInstructionDataArgs['proof'];
};

export async function getEmergencyStopWithProofInstructionAsync<
  TAccountRouter extends string,
  TAccountVerifierEntry extends string,
  TAccountAuthority extends string,
  TAccountVerifierProgram extends string,
  TAccountVerifierProgramData extends string,
  TAccountBpfLoaderUpgradableProgram extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
>(
  input: EmergencyStopWithProofAsyncInput<
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountAuthority,
    TAccountVerifierProgram,
    TAccountVerifierProgramData,
    TAccountBpfLoaderUpgradableProgram,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): Promise<
  EmergencyStopWithProofInstruction<
    TProgramAddress,
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountAuthority,
    TAccountVerifierProgram,
    TAccountVerifierProgramData,
    TAccountBpfLoaderUpgradableProgram,
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
    authority: { value: input.authority ?? null, isWritable: true },
    verifierProgram: { value: input.verifierProgram ?? null, isWritable: true },
    verifierProgramData: {
      value: input.verifierProgramData ?? null,
      isWritable: true,
    },
    bpfLoaderUpgradableProgram: {
      value: input.bpfLoaderUpgradableProgram ?? null,
      isWritable: false,
    },
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
      programAddress:
        'BPFLoaderUpgradeab1e11111111111111111111111' as Address<'BPFLoaderUpgradeab1e11111111111111111111111'>,
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
      getAccountMeta(accounts.authority),
      getAccountMeta(accounts.verifierProgram),
      getAccountMeta(accounts.verifierProgramData),
      getAccountMeta(accounts.bpfLoaderUpgradableProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getEmergencyStopWithProofInstructionDataEncoder().encode(
      args as EmergencyStopWithProofInstructionDataArgs
    ),
  } as EmergencyStopWithProofInstruction<
    TProgramAddress,
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountAuthority,
    TAccountVerifierProgram,
    TAccountVerifierProgramData,
    TAccountBpfLoaderUpgradableProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type EmergencyStopWithProofInput<
  TAccountRouter extends string = string,
  TAccountVerifierEntry extends string = string,
  TAccountAuthority extends string = string,
  TAccountVerifierProgram extends string = string,
  TAccountVerifierProgramData extends string = string,
  TAccountBpfLoaderUpgradableProgram extends string = string,
  TAccountSystemProgram extends string = string,
> = {
  /** The router account PDA managing verifiers and required Upgrade Authority address of verifier */
  router: Address<TAccountRouter>;
  /**
   * The verifier entry of the program to be stopped.
   * This entry will be closed and refunded to the caller on successful stop
   */
  verifierEntry: Address<TAccountVerifierEntry>;
  /**
   * The authority attempting the emergency stop (either the router owner OR the person presenting proof of exploit)
   * The authority will get the rent refund of both the program account of the verifier and the verifierEntry account
   */
  authority: TransactionSigner<TAccountAuthority>;
  /**
   * The program account of the verifier to be used Address is verified against VerifierEntry
   * Must be Unchecked as there could be any program ID here.
   * This account will be closed by a CPI call to the Loader V3 and rent refunded to the authority
   */
  verifierProgram: Address<TAccountVerifierProgram>;
  /** The Program Data account of the verifier to be closed */
  verifierProgramData: Address<TAccountVerifierProgramData>;
  /**
   * This is the Loader V3 BPF Upgrade program, Not written in Anchor so we cannot use the
   * CPI extensions to automatically generate a secure CPI call and must do so manually
   */
  bpfLoaderUpgradableProgram: Address<TAccountBpfLoaderUpgradableProgram>;
  /** Required because we are closing accounts */
  systemProgram?: Address<TAccountSystemProgram>;
  selector: EmergencyStopWithProofInstructionDataArgs['selector'];
  proof: EmergencyStopWithProofInstructionDataArgs['proof'];
};

export function getEmergencyStopWithProofInstruction<
  TAccountRouter extends string,
  TAccountVerifierEntry extends string,
  TAccountAuthority extends string,
  TAccountVerifierProgram extends string,
  TAccountVerifierProgramData extends string,
  TAccountBpfLoaderUpgradableProgram extends string,
  TAccountSystemProgram extends string,
  TProgramAddress extends Address = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
>(
  input: EmergencyStopWithProofInput<
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountAuthority,
    TAccountVerifierProgram,
    TAccountVerifierProgramData,
    TAccountBpfLoaderUpgradableProgram,
    TAccountSystemProgram
  >,
  config?: { programAddress?: TProgramAddress }
): EmergencyStopWithProofInstruction<
  TProgramAddress,
  TAccountRouter,
  TAccountVerifierEntry,
  TAccountAuthority,
  TAccountVerifierProgram,
  TAccountVerifierProgramData,
  TAccountBpfLoaderUpgradableProgram,
  TAccountSystemProgram
> {
  // Program address.
  const programAddress =
    config?.programAddress ?? VERIFIER_ROUTER_PROGRAM_ADDRESS;

  // Original accounts.
  const originalAccounts = {
    router: { value: input.router ?? null, isWritable: true },
    verifierEntry: { value: input.verifierEntry ?? null, isWritable: true },
    authority: { value: input.authority ?? null, isWritable: true },
    verifierProgram: { value: input.verifierProgram ?? null, isWritable: true },
    verifierProgramData: {
      value: input.verifierProgramData ?? null,
      isWritable: true,
    },
    bpfLoaderUpgradableProgram: {
      value: input.bpfLoaderUpgradableProgram ?? null,
      isWritable: false,
    },
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
      getAccountMeta(accounts.authority),
      getAccountMeta(accounts.verifierProgram),
      getAccountMeta(accounts.verifierProgramData),
      getAccountMeta(accounts.bpfLoaderUpgradableProgram),
      getAccountMeta(accounts.systemProgram),
    ],
    programAddress,
    data: getEmergencyStopWithProofInstructionDataEncoder().encode(
      args as EmergencyStopWithProofInstructionDataArgs
    ),
  } as EmergencyStopWithProofInstruction<
    TProgramAddress,
    TAccountRouter,
    TAccountVerifierEntry,
    TAccountAuthority,
    TAccountVerifierProgram,
    TAccountVerifierProgramData,
    TAccountBpfLoaderUpgradableProgram,
    TAccountSystemProgram
  >;

  return instruction;
}

export type ParsedEmergencyStopWithProofInstruction<
  TProgram extends string = typeof VERIFIER_ROUTER_PROGRAM_ADDRESS,
  TAccountMetas extends readonly IAccountMeta[] = readonly IAccountMeta[],
> = {
  programAddress: Address<TProgram>;
  accounts: {
    /** The router account PDA managing verifiers and required Upgrade Authority address of verifier */
    router: TAccountMetas[0];
    /**
     * The verifier entry of the program to be stopped.
     * This entry will be closed and refunded to the caller on successful stop
     */

    verifierEntry: TAccountMetas[1];
    /**
     * The authority attempting the emergency stop (either the router owner OR the person presenting proof of exploit)
     * The authority will get the rent refund of both the program account of the verifier and the verifierEntry account
     */

    authority: TAccountMetas[2];
    /**
     * The program account of the verifier to be used Address is verified against VerifierEntry
     * Must be Unchecked as there could be any program ID here.
     * This account will be closed by a CPI call to the Loader V3 and rent refunded to the authority
     */

    verifierProgram: TAccountMetas[3];
    /** The Program Data account of the verifier to be closed */
    verifierProgramData: TAccountMetas[4];
    /**
     * This is the Loader V3 BPF Upgrade program, Not written in Anchor so we cannot use the
     * CPI extensions to automatically generate a secure CPI call and must do so manually
     */

    bpfLoaderUpgradableProgram: TAccountMetas[5];
    /** Required because we are closing accounts */
    systemProgram: TAccountMetas[6];
  };
  data: EmergencyStopWithProofInstructionData;
};

export function parseEmergencyStopWithProofInstruction<
  TProgram extends string,
  TAccountMetas extends readonly IAccountMeta[],
>(
  instruction: IInstruction<TProgram> &
    IInstructionWithAccounts<TAccountMetas> &
    IInstructionWithData<Uint8Array>
): ParsedEmergencyStopWithProofInstruction<TProgram, TAccountMetas> {
  if (instruction.accounts.length < 7) {
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
      authority: getNextAccount(),
      verifierProgram: getNextAccount(),
      verifierProgramData: getNextAccount(),
      bpfLoaderUpgradableProgram: getNextAccount(),
      systemProgram: getNextAccount(),
    },
    data: getEmergencyStopWithProofInstructionDataDecoder().decode(
      instruction.data
    ),
  };
}
