/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  containsBytes,
  getU32Encoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  type ParsedCloseInstruction,
  type ParsedDeployWithMaxDataLenInstruction,
  type ParsedExtendProgramInstruction,
  type ParsedInitializeBufferInstruction,
  type ParsedSetAuthorityCheckedInstruction,
  type ParsedSetAuthorityInstruction,
  type ParsedUpgradeInstruction,
  type ParsedWriteInstruction,
} from '../instructions';

export const SOLANA_LOADER_V3_PROGRAM_PROGRAM_ADDRESS =
  'BPFLoaderUpgradeab1e11111111111111111111111' as Address<'BPFLoaderUpgradeab1e11111111111111111111111'>;

export enum SolanaLoaderV3ProgramInstruction {
  InitializeBuffer,
  Write,
  DeployWithMaxDataLen,
  Upgrade,
  SetAuthority,
  Close,
  ExtendProgram,
  SetAuthorityChecked,
}

export function identifySolanaLoaderV3ProgramInstruction(
  instruction: { data: ReadonlyUint8Array } | ReadonlyUint8Array
): SolanaLoaderV3ProgramInstruction {
  const data = 'data' in instruction ? instruction.data : instruction;
  if (containsBytes(data, getU32Encoder().encode(0), 0)) {
    return SolanaLoaderV3ProgramInstruction.InitializeBuffer;
  }
  if (containsBytes(data, getU32Encoder().encode(1), 0)) {
    return SolanaLoaderV3ProgramInstruction.Write;
  }
  if (containsBytes(data, getU32Encoder().encode(2), 0)) {
    return SolanaLoaderV3ProgramInstruction.DeployWithMaxDataLen;
  }
  if (containsBytes(data, getU32Encoder().encode(3), 0)) {
    return SolanaLoaderV3ProgramInstruction.Upgrade;
  }
  if (containsBytes(data, getU32Encoder().encode(4), 0)) {
    return SolanaLoaderV3ProgramInstruction.SetAuthority;
  }
  if (containsBytes(data, getU32Encoder().encode(5), 0)) {
    return SolanaLoaderV3ProgramInstruction.Close;
  }
  if (containsBytes(data, getU32Encoder().encode(6), 0)) {
    return SolanaLoaderV3ProgramInstruction.ExtendProgram;
  }
  if (containsBytes(data, getU32Encoder().encode(7), 0)) {
    return SolanaLoaderV3ProgramInstruction.SetAuthorityChecked;
  }
  throw new Error(
    'The provided instruction could not be identified as a solanaLoaderV3Program instruction.'
  );
}

export type ParsedSolanaLoaderV3ProgramInstruction<
  TProgram extends string = 'BPFLoaderUpgradeab1e11111111111111111111111',
> =
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.InitializeBuffer;
    } & ParsedInitializeBufferInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.Write;
    } & ParsedWriteInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.DeployWithMaxDataLen;
    } & ParsedDeployWithMaxDataLenInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.Upgrade;
    } & ParsedUpgradeInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.SetAuthority;
    } & ParsedSetAuthorityInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.Close;
    } & ParsedCloseInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.ExtendProgram;
    } & ParsedExtendProgramInstruction<TProgram>)
  | ({
      instructionType: SolanaLoaderV3ProgramInstruction.SetAuthorityChecked;
    } & ParsedSetAuthorityCheckedInstruction<TProgram>);
