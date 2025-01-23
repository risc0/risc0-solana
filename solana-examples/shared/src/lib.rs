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

// Anchor uses an old version of Borsh 0.10.3 make sure your project
// uses this version for compatibility in anchor
use borsh::{BorshDeserialize, BorshSerialize};

// This is where we define data that will be shared between our
// host program, our guest program, and our Solana on chain program.
#[derive(Debug, BorshSerialize, BorshDeserialize, Clone, Hash)]
pub struct IncrementNonceArguments {
    pub account: [u8; 32],
    pub nonce: u32,
}
