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

/// Event emitted when an emergency stop is executed on a verifier
///
/// # Fields
/// * `router` - The public key of the router account managing the verifier
/// * `selector` - A u32 that uniquely identifies the verifier entry in the router
/// * `verifier` - The public key of the verifier program being emergency stopped
/// * `triggered_by` - The public key of the account that initiated the emergency stop
/// * `reason` - A string explaining why the emergency stop was triggered
#[event]
pub struct EmergencyStopEvent {
    pub router: Pubkey,
    pub selector: u32,
    pub verifier: Pubkey,
    pub triggered_by: Pubkey,
    pub reason: String,
}
