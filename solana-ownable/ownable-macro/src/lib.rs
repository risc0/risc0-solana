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

//! Procedural macro implementation for the Ownable trait
//!
//! This module provides the derive macro implementation that generates the necessary
//! Anchor account structures and implementation methods for ownership management.
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

/// Derives the Ownable trait for an Anchor account struct
///
/// This proc macro generates the following for the decorated struct:
/// - Account validation structures for ownership management instructions
/// - Implementation of ownership transfer methods
/// - Integration with Anchor's Context system
///
/// # Requirements
/// - The decorated struct must contain an `ownership: Ownership` field
/// - The struct must be an Anchor account (decorated with `#[account]`)
///
/// # Generated Structures
/// For a struct named `MyAccount`, the following structures are generated:
/// - `MyAccountTransferOwnership`
/// - `MyAccountAcceptOwnership`
/// - `MyAccountRenounceOwnership`
/// - `MyAccountCancelTransfer`
///
/// # Notice
/// You *MUST* expose the various methods for account management in your program/contract otherwise
/// you may not be able to transfer or accept ownership of your accounts.
///
/// Each structure implements Anchor's `Accounts` trait for instruction validation.
///
/// # Example
/// ```rust
/// #[account]
/// #[derive(Ownable)]
/// pub struct TestState {
///     pub ownership: Ownership, // Size is 66 bytes
///     pub data: u64,
/// }
///
/// #[program]
/// pub mod test_program {
///     use super::*;
///
///     pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
///         ctx.accounts.state.ownership = Ownership::new(ctx.accounts.authority.key())?;
///         Ok(())
///     }
///
///     pub fn transfer_ownership(
///         ctx: Context<TestStateTransferOwnership>,
///         new_owner: Pubkey,
///     ) -> Result<()> {
///         TestState::transfer_ownership(ctx, new_owner)
///     }
///
///     pub fn accept_ownership(ctx: Context<TestStateAcceptOwnership>) -> Result<()> {
///         TestState::accept_ownership(ctx)
///     }
///
///     pub fn renounce_ownership(ctx: Context<TestStateRenounceOwnership>) -> Result<()> {
///         TestState::renounce_ownership(ctx)
///     }
///
///     pub fn cancel_transfer(ctx: Context<TestStateCancelTransfer>) -> Result<()> {
///         TestState::cancel_transfer(ctx)
///     }
/// }
/// ```
#[proc_macro_derive(Ownable)]
pub fn ownable_derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = input.ident;

    // Generate unique identifiers for each account structure
    // These will be used as the names for the Context types
    let transfer_ownership_name =
        syn::Ident::new(&format!("{}TransferOwnership", name), name.span());
    let accept_ownership_name = syn::Ident::new(&format!("{}AcceptOwnership", name), name.span());
    let renounce_ownership_name =
        syn::Ident::new(&format!("{}RenounceOwnership", name), name.span());
    let cancel_transfer_name = syn::Ident::new(&format!("{}CancelTransfer", name), name.span());

    let expanded = quote! {
        /// Account validation for transferring ownership
        ///
        /// Verifies that:
        /// - The state account is mutable
        /// - The authority (signer) is mutable and has signed the transaction
        #[derive(Accounts)]
        pub struct #transfer_ownership_name<'info> {
            #[account(mut)]
            pub state: Account<'info, #name>,
            #[account(mut)]
            pub authority: Signer<'info>,
        }

        /// Account validation for accepting ownership
        ///
        /// Verifies that:
        /// - The state account is mutable
        /// - The authority (signer) is mutable and has signed the transaction
        #[derive(Accounts)]
        pub struct #accept_ownership_name<'info> {
            #[account(mut)]
            pub state: Account<'info, #name>,
            #[account(mut)]
            pub authority: Signer<'info>,
        }

        /// Account validation for renouncing ownership
        ///
        /// Verifies that:
        /// - The state account is mutable
        /// - The authority (signer) is mutable and has signed the transaction
        #[derive(Accounts)]
        pub struct #renounce_ownership_name<'info> {
            #[account(mut)]
            pub state: Account<'info, #name>,
            #[account(mut)]
            pub authority: Signer<'info>,
        }

        /// Account validation for canceling an ownership transfer
        ///
        /// Verifies that:
        /// - The state account is mutable
        /// - The authority (signer) is mutable and has signed the transaction
        #[derive(Accounts)]
        pub struct #cancel_transfer_name<'info> {
            #[account(mut)]
            pub state: Account<'info, #name>,
            #[account(mut)]
            pub authority: Signer<'info>,
        }

        // Implementation of ownership methods from autogenerated anchor contexts
        impl #name {
            /// Initiates the transfer of ownership to a new address
            ///
            /// # Arguments
            /// * `ctx` - Anchor Context containing the account and authority
            /// * `new_owner` - Public key of the proposed new owner
            ///
            /// # Returns
            /// * `Ok(())` if the transfer is initiated successfully
            /// * `Err` if the operation fails (see `OwnableError` for possible errors)
            pub fn transfer_ownership(
                ctx: Context<#transfer_ownership_name>,
                new_owner: Pubkey
            ) -> Result<()> {
                ctx.accounts.state.ownership.transfer_ownership(
                    new_owner,
                    &ctx.accounts.authority
                )
            }

            /// Accepts a pending ownership transfer
            ///
            /// # Arguments
            /// * `ctx` - Anchor Context containing the account and authority
            ///
            /// # Returns
            /// * `Ok(())` if ownership is transferred successfully
            /// * `Err` if the operation fails (see `OwnableError` for possible errors)
            pub fn accept_ownership(ctx: Context<#accept_ownership_name>) -> Result<()> {
                ctx.accounts.state.ownership.accept_ownership(&ctx.accounts.authority)
            }

            /// Permanently removes owner privileges
            ///
            /// # Arguments
            /// * `ctx` - Anchor Context containing the account and authority
            ///
            /// # Returns
            /// * `Ok(())` if ownership is successfully renounced
            /// * `Err` if the operation fails (see `OwnableError` for possible errors)
            pub fn renounce_ownership(ctx: Context<#renounce_ownership_name>) -> Result<()> {
                ctx.accounts.state.ownership.renounce_ownership(&ctx.accounts.authority)
            }

            /// Cancels a pending ownership transfer
            ///
            /// # Arguments
            /// * `ctx` - Anchor Context containing the account and authority
            ///
            /// # Returns
            /// * `Ok(())` if the transfer is successfully canceled
            /// * `Err` if the operation fails (see `OwnableError` for possible errors)
            pub fn cancel_transfer(ctx: Context<#cancel_transfer_name>) -> Result<()> {
                ctx.accounts.state.ownership.cancel_transfer(&ctx.accounts.authority)
            }
        }
    };

    TokenStream::from(expanded)
}
