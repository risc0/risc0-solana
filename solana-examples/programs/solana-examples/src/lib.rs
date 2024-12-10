use anchor_lang::prelude::*;
use verifier_router::cpi::accounts::Verify;
use verifier_router::program::VerifierRouter;
use verifier_router::router::{Groth16Verifier, Proof, PublicInputs, VerificationKey};
use verifier_router::state::VerifierEntry;

declare_id!("HRA9VM1DJNhzuLhPG8k9Gb97PYocXJbRuNtZhnRmLiKC");

#[program]
pub mod solana_examples {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, selector: u32) -> Result<()> {
        ctx.accounts.program_data.selector = selector;
        ctx.accounts.program_data.nonce = 0;
        Ok(())
    }

    pub fn increment_nonce(
        ctx: Context<ProveRun>,
        proof: Proof,
        journal_nonce: u32,
        imageId: [u8; 32],
    ) -> Result<()> {
        // TODO: Verify that the proof comes from the correct Image ID
        require!(
            journal_nonce == ctx.accounts.program_data.nonce + 1,
            ExampleErrors::BadProof
        );
        // TODO: Verify that the proof input is only one greater then the current nonce
        // Create the CPI context for the router
        let cpi_accounts = Verify {
            router: ctx.accounts.router.to_account_info(),
            verifier_entry: ctx.accounts.verifier_entry.to_account_info(),
            verifier_program: ctx.accounts.groth16_verifier.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        // TODO: Calculate Journal Digest from nonce on chain
        let journal_digest: [u8; 32] = [0; 32];

        let cpi_ctx = CpiContext::new(ctx.accounts.router.to_account_info(), cpi_accounts);

        // Call verify through the router, which will then call the actual verifier
        verifier_router::cpi::verify(
            cpi_ctx,
            proof,
            ctx.accounts.program_data.selector,
            imageId,
            journal_digest,
        )?;

        // Increment the nonce
        ctx.accounts.program_data.nonce += 1;

        Ok(())
    }
}

#[account]
pub struct ProgramData {
    pub selector: u32,
    pub nonce: u32,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 4 + 4 // discriminator + selector + nonce
    )]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProveRun<'info> {
    #[account(mut)]
    pub program_data: Account<'info, ProgramData>,

    // The router program that will route to the correct verifier
    pub router: Program<'info, VerifierRouter>,

    // The PDA entry in the router that maps our selector to the actual verifier
    #[account(
        seeds = [
            b"verifier",
            router.key().as_ref(),
            &program_data.selector.to_le_bytes()
        ],
        bump,
        seeds::program = verifier_router::ID,
    )]
    pub verifier_entry: Account<'info, VerifierEntry>,

    // The actual Groth16 verifier program that will verify the proof
    #[account(constraint = groth16_verifier.key() == verifier_entry.verifier @ ExampleErrors::InvalidVerifier)]
    pub groth16_verifier: Program<'info, Groth16Verifier>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ExampleErrors {
    #[msg("Invalid verifier selected")]
    InvalidVerifier,
    #[msg("Bad Proof")]
    BadProof,
}
