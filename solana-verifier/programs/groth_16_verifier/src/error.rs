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

#[error_code]
pub enum VerifierError {
    #[msg("G1 compression error")]
    G1CompressionError,
    #[msg("G2 compression error")]
    G2CompressionError,
    #[msg("Verification error")]
    VerificationError,
    #[msg("Invalid public input")]
    InvalidPublicInput,
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Pairing error")]
    PairingError,
}
