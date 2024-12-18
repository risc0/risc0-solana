pub mod error;
pub use error::RouterError;
pub use groth_16_verifier::{Proof, PublicInputs, VerificationKey};

use crate::state::{VerifierEntry, VerifierRouter};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use ownable::Ownership;
pub use groth_16_verifier::program::Groth16Verifier;
use groth_16_verifier::cpi::accounts::VerifyProof;

/// Account validation struct for router initialization
#[derive(Accounts)]
pub struct Initialize<'info> {
   /// The router account to be initialized
   /// Space allocated for discriminator + owner + option<pending_owner> + count
   #[account(
       init,
       seeds = [b"router"],
       bump,
       payer = authority,
       space = 8 + 32 + 33 + 4 
   )]
   pub router: Account<'info, VerifierRouter>,
   
   /// The authority initializing and paying for the router
   #[account(mut)]
   pub authority: Signer<'info>,
   
   /// Required for account initialization
   pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(selector: u32)]
pub struct AddVerifier<'info> {
    #[account(
        mut,
        seeds = [b"router"],
        bump
    )]
    pub router: Account<'info, VerifierRouter>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 4,
        seeds = [
            b"verifier",
            selector.to_le_bytes().as_ref()
        ],
        bump,
        constraint = selector == router.verifier_count + 1 @ RouterError::SelectorInvalid
    )]
    pub verifier_entry: Account<'info, VerifierEntry>,

    #[account(
        seeds = [
                verifier_program.key().as_ref()
            ],
            bump,
            seeds::program = bpf_loader_upgradeable::ID,
            constraint = verifier_program_data.upgrade_authority_address == Some(router.key()) @ RouterError::VerifierInvalidAuthority
    )]
    pub verifier_program_data: Account<'info, ProgramData>,

    #[account(
        executable
    )]
    /// CHECK: checks are done by constraint in program data account
    pub verifier_program: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Account validation struct for verifier operations
///
/// # Arguments
/// * `selector` - A u32 that uniquely identifies the verifier entry
#[derive(Accounts)]
#[instruction(selector: u32)]
pub struct Verify<'info> {
   /// The router account containing the verifier registry
   #[account(
    seeds = [b"router"],
    bump
   )]
   pub router: Account<'info, VerifierRouter>,
   
   /// The verifier entry to use, validated using PDA derivation
   /// Seeds are ["verifier", selector_bytes]
   #[account(
       seeds = [
            b"verifier",
            selector.to_le_bytes().as_ref()
       ],
       bump,
       constraint = verifier_entry.selector == selector,
   )]
   pub verifier_entry: Account<'info, VerifierEntry>,

   /// The verifier Program account that is matched to the verifier entry 
   /// CHECK: Manually checked to be the same value of the verifier entry program
   #[account(
        executable,
        address = verifier_entry.verifier @ RouterError::InvalidVerifier
   )]
   pub verifier_program: UncheckedAccount<'info>,

   /// CHECK: Only included to staisfy Anchor CPI requirements
   pub system_program: Program<'info, System>
}

/// Initializes a new router with the given authority as owner
///
/// # Arguments
/// * `ctx` - The context containing validated accounts
///
/// # Returns
/// * `Ok(())` if initialization is successful
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
   let router = &mut ctx.accounts.router;
   router.ownership = Ownership::new(ctx.accounts.authority.key())?;
   router.verifier_count = 0;
   Ok(())
}

/// Add a new verifier to the router
///
/// # Arguments
/// * `ctx` - The context containing validated accounts
/// * `selector` - The selector to associate with this verifier
/// * `verifier` - The public key of the verifier program
///
/// # Returns
/// * `Ok(())` if the verifier is successfully added
/// * `Err(RouterError::SelectorInUse)` if the selector is already in use
/// * `Err(RouterError::InvalidLoader)` if the verifier uses the wrong loader
/// * `Err(RouterError::InvalidAuthority)` if the router is not the upgrade authority
/// * `Err(RouterError::Overflow)` if adding the verifier would overflow the counter
pub fn add_verifier(ctx: Context<AddVerifier>, selector: u32) -> Result<()> {
    // Verify the caller is the owner of the contract
    ctx.accounts
        .router
        .ownership
        .assert_owner(&ctx.accounts.authority)?;

    let router = &mut ctx.accounts.router;
    let entry = &mut ctx.accounts.verifier_entry;

    entry.selector = selector;
    entry.verifier = ctx.accounts.verifier_program.key();

    router.verifier_count = router
        .verifier_count
        .checked_add(1)
        .ok_or(error!(RouterError::Overflow))?;

    Ok(())
}

/// Verifies a proof using the specified verifier
///
/// # Arguments
/// * `ctx` - The context containing validated accounts
/// * `seal` - The seal data to be verified
/// * `image_id` - The image ID associated with the proof
/// * `journal_digest` - The journal digest for verification
///
/// # Returns
/// * `Ok(())` if the verification is successful 
pub fn verify(
   ctx: Context<Verify>,
   proof: Proof,
   image_id: [u8; 32],
   journal_digest: [u8; 32],
) -> Result<()> {
   let verifier = &ctx.accounts.verifier_entry;

    let verifier_program = ctx.accounts.verifier_program.to_account_info();
    let verifier_accounts = VerifyProof { 
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let verify_ctx = CpiContext::new(verifier_program, verifier_accounts);
    groth_16_verifier::cpi::verify(verify_ctx, proof, image_id, journal_digest)
}