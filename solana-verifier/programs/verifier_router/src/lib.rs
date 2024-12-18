use anchor_lang::prelude::*;
use groth_16_verifier::{Proof, PublicInputs, VerificationKey};

pub mod estop;
pub mod router;
pub mod state;
pub use ownable::OwnableError;

use estop::*;
use router::*;
use state::*;

declare_id!("DNzgxRPwrWW7ZVTVWr5zhhHAJMjzs3B17eVpZVJfvzHa");
#[program]
pub mod verifier_router {
    use ownable::OwnableError;
    use state::VerifierRouter;

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        router::initialize(ctx)
    }

    pub fn add_verifier(ctx: Context<AddVerifier>, selector: u32) -> Result<()> {
        // This function checks ownership and can only be called by the owner
        router::add_verifier(ctx, selector)
    }

    pub fn verify(
        ctx: Context<Verify>,
        selector: u32,
        proof: Proof,
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        router::verify(ctx, proof, image_id, journal_digest)
    }

    pub fn emergency_stop(ctx: Context<EmergencyStop>, selector: u32) -> Result<()> {
        // This function checks ownership and can only be called by the owner
        estop::emergency_stop_by_owner(ctx, selector)
    }

    pub fn emergency_stop_with_proof(
        ctx: Context<EmergencyStop>,
        selector: u32,
        proof: Proof,
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        estop::emergency_stop_with_proof(ctx, selector, proof, image_id, journal_digest)
    }

    pub fn transfer_ownership(
        ctx: Context<VerifierRouterTransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        // This function checks ownership and can only be called by the owner
        VerifierRouter::transfer_ownership(ctx, new_owner)
    }

    pub fn accept_ownership(ctx: Context<VerifierRouterAcceptOwnership>) -> Result<()> {
        // This function can only be called by the pending owner
        VerifierRouter::accept_ownership(ctx)
    }

    pub fn cancel_transfer(ctx: Context<VerifierRouterCancelTransfer>) -> Result<()> {
        // This function checks ownership and can only be called by the owner or pending owner
        VerifierRouter::cancel_transfer(ctx)
    }

    pub fn renounce_ownership(ctx: Context<VerifierRouterRenounceOwnership>) -> Result<()> {
        // This function checks ownership and can only be called by the owner
        VerifierRouter::renounce_ownership(ctx)
    }
}
