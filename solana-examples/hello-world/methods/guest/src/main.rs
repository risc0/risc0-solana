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

use borsh::{BorshDeserialize, BorshSerialize};
use risc0_zkvm::guest::env;
use shared::IncrementNonceArguments;

fn main() {
    // read the input, we use the stdin reader since we are using borsh (more common on solana) then Serde which is built into
    // the env::read option
    let mut inputs = IncrementNonceArguments::deserialize_reader(&mut env::stdin()).unwrap();

    // Increment the nonce
    inputs.nonce = inputs.nonce + 1;

    // Our proof very simply deserializes then re-serializes the value
    inputs.serialize(&mut env::journal()).unwrap();
}
