use anchor_lang::prelude::*;
use ownable::{Ownable, Ownership};

/// Main router account storing ownership and verifier count
///
/// This account maintains the registry of verifiers and implements ownership controls
/// for administrative operations.
///
/// Verifier Count is tracked to prevent any verifier from reusing a previously stopped selector
///
/// # Fields
/// * `ownership` - Stores the current and pending owner information using the Ownable trait
/// * `verifier_count` - Total number of verifiers registered in the router
#[account]
#[derive(Ownable)]
pub struct VerifierRouter {
    pub ownership: Ownership,
    pub verifier_count: u32,
}

/// Account storing information about a registered verifier
///
/// Each verifier entry represents a deployed verifier program that can be used
/// for zero-knowledge proof verification.
///
/// # Fields
/// * `selector` - Unique identifier for this verifier entry
/// * `verifier` - Public key of the verifier program
#[account]
pub struct VerifierEntry {
    pub selector: u32,
    pub verifier: Pubkey,
}
