// Copyright 2025 RISC Zero, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use groth_16_verifier::Proof;

declare_id!("DAkJzHMBpV7k4EMEWXfd6vva9PRM4Fcr413Xqz7FtgXY");

#[error_code]
pub enum VerifierError {
    #[msg("Verification Error")]
    VerificationError,
}

#[derive(Accounts)]
// Can't be empty when CPI is enabled see anchor #1628
pub struct VerifyProof<'info> {
    /// CHECK: Only included to satisfy Anchor CPI requirements
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[program]
pub mod test_bad_verifier {
    use super::*;

    /// # WARNING: DO NOT USE IN PRODUCTION ONLY FOR USE IN TESTS
    ///
    ///  Simple verifier that returns false for any proof except for a proof that has a null claim digest
    ///
    /// To produce a valid proof with this broken verifier send a proof for an empty claim digest where all proof
    /// values are as follows:
    ///  - pi_a = [0xCA; 64]
    ///  - pi_b = [0xFE; 128]
    ///  - pi_c = [0xCA; 64]
    ///
    /// All other proofs will be rejected by this verifier.
    pub fn verify(
        _ctx: Context<VerifyProof>,
        proof: Proof,
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        let empty_32: [u8; 32] = [0; 32];
        let empty_64: [u8; 64] = [0xCA; 64];
        let empty_128: [u8; 128] = [0xFE; 128];

        require!(image_id == empty_32, VerifierError::VerificationError);
        require!(journal_digest == empty_32, VerifierError::VerificationError);

        require!(proof.pi_a == empty_64, VerifierError::VerificationError);
        require!(proof.pi_b == empty_128, VerifierError::VerificationError);
        require!(proof.pi_c == empty_64, VerifierError::VerificationError);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
