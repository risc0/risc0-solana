use anchor_lang::prelude::*;
use ownable::{Ownable, Ownership};

/// Main router account storing ownership and verifier count
///
/// # Fields
/// * `ownership` - Stores the current and pending owner information
/// * `verifier_count` - Total number of verifiers registered in the router
#[account]
#[derive(Ownable)]
pub struct VerifierRouter {
    pub ownership: Ownership,
    pub verifier_count: u32,
}

/// Account storing information about a registered verifier
///
/// # Fields
/// * `selector` - Unique identifier for this verifier entry
/// * `verifier` - Public key of the verifier program
/// * `is_active` - Boolean flag indicating if this verifier is currently active
#[account]
pub struct VerifierEntry {
    pub selector: u32,
    pub verifier: Pubkey,
}
