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

//! Ownable Library for Anchor programs
//!
//! This crate provides a derivable trait for implementing two-step ownership transfers
//! for accounts in Solana programs built with the Anchor framework. It follows similar patterns to
//! Solidity's Ownable2Step contract while leveraging Anchor's account system.
//!
//! # Overview
//! The framework generates boilerplate code for creating accounts that can be owned
//! and transferred in a secure two-step process. It's implemented as a proc macro
//! to minimize additional account creation overhead.
//!
//! # Required Methods
//! Programs using this trait must expose the following methods for each account type that is ownable:
//! * `transfer_ownership` - Initiates ownership transfer
//! * `accept_ownership` - Completes ownership transfer
//! * `renounce_ownership` - Permanently remove the owner
//! * `cancel_transfer` - Cancels a pending transfer
//!
//! # Examples
//! ```rust
//! #[account]
//! #[derive(Ownable)]
//! pub struct TestState {
//!     pub ownership: Ownership, // Size is 66 bytes
//!     pub data: u64,
//! }
//! ```
use anchor_lang::prelude::*;
pub use ownable_macro::Ownable;

#[error_code]
pub enum OwnableError {
    /// This error occurs when a privileged operation is attempted by any account
    /// other than the verified owner.
    #[msg("Not the current owner")]
    NotOwner,

    /// This error occurs when the owner of a contract attempts to initiate a transfer
    /// to themselves.
    #[msg("Cannot transfer ownership to yourself")]
    CannotTransferToSelf,

    /// This error occurs when trying to accept or cancel a transfer that hasn't
    /// been initiated.
    #[msg("No pending ownership transfer")]
    NoPendingTransfer,

    /// This error occurs when an account other than the designated pending owner
    /// attempts to accept ownership.
    #[msg("Only the account with a valid pending claim can claim ownership")]
    NotPendingOwner,

    /// This error occurs when the cancel operation is attempted by an account
    /// that is neither the current owner nor the pending owner.
    #[msg("Action can only be submitted by a pending owner or actual owner")]
    NotOwnerOrPendingOwner,

    /// This error occurs when attempting to transfer ownership to the default public key
    #[msg("Cannot transfer ownership to the zero address")]
    InvalidAddress,
}

/// This structure tracks both the current owner and any pending ownership transfers.
/// It's designed to be embedded within Anchor accounts that need ownership functionality.
/// This structure is 66 bytes in size.
///
/// # Example
/// ```rust
/// #[account]
/// #[derive(Ownable)]
/// pub struct TestState {
///     pub ownership: Ownership,
///     pub data: u64,
/// }
/// ```
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Ownership {
    /// The current owner's public key
    owner: Option<Pubkey>,
    /// The public key of the pending owner during a transfer, if any
    pending_owner: Option<Pubkey>,
}

impl Ownership {
    /// Creates a new Ownership instance with a specified initial owner
    ///
    /// # Arguments
    /// * `owner` - The public key to set as the initial owner
    ///
    /// # Returns
    /// * `Ok(Ownership)` with the specified owner and no pending transfer
    /// * `Err(OwnableError::InvalidAddress)` if the owner is the zero address
    pub fn new(owner: Pubkey) -> Result<Self> {
        require!(owner != Pubkey::default(), OwnableError::InvalidAddress);
        Ok(Self {
            owner: Some(owner),
            pending_owner: None,
        })
    }

    /// Verifies that the provided signer is the current owner
    ///
    /// # Arguments
    /// * `authority` - An Anchor Signer type representing the account attempting the operation.
    ///                 Anchor verifies that this account signed the transaction.
    ///
    /// # Returns
    /// * `Ok(())` if the signer matches the current owner
    /// * `Err(OwnableError::NotOwner)` if verification fails
    pub fn assert_owner(&self, authority: &Signer) -> Result<()> {
        require!(self.owner == Some(authority.key()), OwnableError::NotOwner);
        Ok(())
    }

    /// Internal method that verifies that the provided signer is the pending owner
    ///
    /// # Arguments
    /// * `authority` - An Anchor Signer type representing the account attempting the operation.
    ///                 Anchor verifies that this account signed the transaction.
    ///
    /// # Returns
    /// * `Ok(())` if the signer matches the pending owner
    /// * `Err(OwnableError::NoPendingTransfer)` if no transfer is in progress
    /// * `Err(OwnableError::NotPendingOwner)` if the signer is not the pending owner
    fn assert_pending_owner(&self, authority: &Signer) -> Result<()> {
        require!(
            self.pending_owner.is_some(),
            OwnableError::NoPendingTransfer
        );
        require!(
            Some(authority.key()) == self.pending_owner,
            OwnableError::NotPendingOwner
        );
        Ok(())
    }

    /// Initiates an ownership transfer to a new address
    ///
    /// # Arguments
    /// * `new_owner` - The public key of the proposed new owner
    /// * `authority` - An Anchor Signer type representing the current owner's account.
    ///                 Anchor verifies that this account signed the transaction.
    ///
    /// # Returns
    /// * `Ok(())` if the transfer is initiated
    /// * `Err(OwnableError::NotOwner)` if the signer is not the current owner
    /// * `Err(OwnableError::InvalidAddress)` if attempting to transfer to the zero address
    pub fn transfer_ownership(&mut self, new_owner: Pubkey, authority: &Signer) -> Result<()> {
        self.assert_owner(authority)?;
        require!(
            new_owner != authority.key(),
            OwnableError::CannotTransferToSelf
        );
        require!(new_owner != Pubkey::default(), OwnableError::InvalidAddress);
        self.pending_owner = Some(new_owner);
        Ok(())
    }

    /// Completes a pending ownership transfer
    ///
    /// The pending owner must call this method to accept the transfer and become
    /// the new owner. This two-step process helps prevent accidental transfers
    /// to incorrect addresses.
    ///
    /// # Arguments
    /// * `authority` - An Anchor Signer type representing the pending owner's account.
    ///                 Anchor verifies that this account signed the transaction.
    ///
    /// # Returns
    /// * `Ok(())` if ownership is transferred successfully
    /// * `Err(OwnableError::NoPendingTransfer)` if no transfer is in progress
    /// * `Err(OwnableError::NotPendingOwner)` if the signer is not the pending owner
    pub fn accept_ownership(&mut self, authority: &Signer) -> Result<()> {
        self.assert_pending_owner(authority)?;
        self.owner = Some(authority.key());
        self.pending_owner = None;
        Ok(())
    }

    /// Permanently removes owner privileges by setting owner to None
    ///
    /// # Warning
    /// This action is irreversible. Once ownership is renounced, no new owner can
    /// be set and privileged operations become permanently inaccessible.
    ///
    /// # Arguments
    /// * `authority` - An Anchor Signer type representing the current owner's account.
    ///                 Anchor verifies that this account signed the transaction.
    ///
    /// # Returns
    /// * `Ok(())` if ownership is successfully renounced
    /// * `Err(OwnableError::NotOwner)` if the signer is not the current owner
    pub fn renounce_ownership(&mut self, authority: &Signer) -> Result<()> {
        self.assert_owner(authority)?;
        self.owner = None;
        self.pending_owner = None;
        Ok(())
    }

    /// Cancels a pending ownership transfer
    ///
    /// This method can be called by either the current owner or the pending owner
    /// to cancel an in-progress ownership transfer.
    ///
    /// # Arguments
    /// * `authority` - An Anchor Signer type representing either the current owner's
    ///                 or pending owner's account. Anchor verifies that this account
    ///                 signed the transaction.
    ///
    /// # Returns
    /// * `Ok(())` if the transfer is successfully canceled
    /// * `Err(OwnableError::NoPendingTransfer)` if no transfer is in progress
    /// * `Err(OwnableError::NotOwnerOrPendingOwner)` if the signer is neither the
    ///   current owner nor the pending owner
    pub fn cancel_transfer(&mut self, authority: &Signer) -> Result<()> {
        require!(
            self.pending_owner.is_some(),
            OwnableError::NoPendingTransfer
        );
        self.assert_owner(authority)
            .or_else(|_| self.assert_pending_owner(authority))
            .map_err(|_| OwnableError::NotOwnerOrPendingOwner)?;
        self.pending_owner = None;
        Ok(())
    }
}
