/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
  containsBytes,
  fixEncoderSize,
  getBytesEncoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/web3.js';
import { type ParsedVerifyInstruction } from '../instructions';

export const TEST_BAD_VERIFIER_PROGRAM_ADDRESS =
  'H111vaTfs4ktTvJFqy46UFq5sjcEkixgmHwuHc6oabD8' as Address<'H111vaTfs4ktTvJFqy46UFq5sjcEkixgmHwuHc6oabD8'>;

export enum TestBadVerifierInstruction {
  Verify,
}

export function identifyTestBadVerifierInstruction(
  instruction: { data: ReadonlyUint8Array } | ReadonlyUint8Array
): TestBadVerifierInstruction {
  const data = 'data' in instruction ? instruction.data : instruction;
  if (
    containsBytes(
      data,
      fixEncoderSize(getBytesEncoder(), 8).encode(
        new Uint8Array([133, 161, 141, 48, 120, 198, 88, 150])
      ),
      0
    )
  ) {
    return TestBadVerifierInstruction.Verify;
  }
  throw new Error(
    'The provided instruction could not be identified as a testBadVerifier instruction.'
  );
}

export type ParsedTestBadVerifierInstruction<
  TProgram extends string = 'H111vaTfs4ktTvJFqy46UFq5sjcEkixgmHwuHc6oabD8',
> = {
  instructionType: TestBadVerifierInstruction.Verify;
} & ParsedVerifyInstruction<TProgram>;
