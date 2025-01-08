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
///
/// # Security Considerations
/// * Initializes a new PDA with seeds = [b"router"]
/// * Requires a signing authority that will become the initial owner
/// * Allocates space for ownership data and verifier count
#[derive(Accounts)]
pub struct Initialize<'info> {
   /// The router account PDA to be initialized
   /// Space allocated for discriminator + owner (Option<Pubkey>) + pending_owner: (Option<Pubkey>) + count (u32)
   #[account(
       init,
       seeds = [b"router"],
       bump,
       payer = authority,
       space = 8 + 33 + 33 + 4 
   )]
   pub router: Account<'info, VerifierRouter>,
   
   /// The authority initializing and paying for the router
   #[account(mut)]
   pub authority: Signer<'info>,
   
   /// Required for account initialization
   pub system_program: Program<'info, System>,
}

/// Account validation for adding a new verifier program
///
/// # Security Considerations
/// * Validates the verifier program's upgrade authority is the router
/// * Ensures sequential selector assignment
/// * Creates a PDA for the verifier entry with seeds = [b"verifier", selector_bytes]
#[derive(Accounts)]
#[instruction(selector: u32)]
pub struct AddVerifier<'info> {
    /// The router account PDA managing verifiers and required Upgrade Authority address of verifier
    #[account(
        mut,
        seeds = [b"router"],
        bump
    )]
    pub router: Account<'info, VerifierRouter>,

    /// The new verifier entry to be created which must have a selector in sequential order
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

    /// Program data account (Data of account authority from LoaderV3) of the verifier being added
    #[account(
        seeds = [
                verifier_program.key().as_ref()
            ],
            bump,
            seeds::program = bpf_loader_upgradeable::ID,
            constraint = verifier_program_data.upgrade_authority_address == Some(router.key()) @ RouterError::VerifierInvalidAuthority
    )]
    pub verifier_program_data: Account<'info, ProgramData>,

    /// The program executable code account of the verifier program to be added
    /// Must be an unchecked account because any program ID can be here
    /// CHECK: checks are done by constraint in program data account
    #[account(
        executable
    )]
    pub verifier_program: UncheckedAccount<'info>,
    
    /// The owner of the router which must sign this transaction
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Required for account initialization
    pub system_program: Program<'info, System>,
}

/// Account validation for verifier calls
///
/// Validates accounts needed for proof verification and ensures the
/// verifier program matches the registered entry of the requested selector.
/// 
/// Ensures a program is not attempting to use a selector which had been E-Stopped. 
///
/// # Arguments
/// * `selector` - A u32 that uniquely identifies the verifier entry
#[derive(Accounts)]
#[instruction(selector: u32)]
pub struct Verify<'info> {
    /// The router account PDA managing verifiers
   #[account(
    seeds = [b"router"],
    bump
   )]
   pub router: Account<'info, VerifierRouter>,
   
    /// The verifier entry to use, validated using PDA derivation
   #[account(
       seeds = [
            b"verifier",
            selector.to_le_bytes().as_ref()
       ],
       bump,
       constraint = verifier_entry.selector == selector,
   )]
   pub verifier_entry: Account<'info, VerifierEntry>,

   /// The verifier program to be invoked
   /// Must match the address of the program listed in the verifier entry of the specific selector
   /// Must be an unchecked account because any program ID can be here
   /// CHECK: Manually checked to be the same value of the verifier entry program
   #[account(
        executable,
        address = verifier_entry.verifier @ RouterError::InvalidVerifier
   )]
   pub verifier_program: UncheckedAccount<'info>,

   /// CHECK: Only included to satisfy Anchor CPI Lifetime requirements
   pub system_program: Program<'info, System>
}

/// Initializes a new router with the given authority as owner
///
/// Creates a new router account initialized as a PDA and sets up initial
/// ownership and verifier count.
///
/// # Arguments
/// * `ctx` - The Initialize context containing validated accounts
///
/// # Returns
/// * `Ok(())` if initialization is successful
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
   let router = &mut ctx.accounts.router;
   router.ownership = Ownership::new(ctx.accounts.authority.key())?;
   router.verifier_count = 0;
   Ok(())
}

/// Adds a new verifier to the router's registry
///
/// Creates a new verifier entry and associates it with the provided selector.
/// Only callable by the router's owner. Checks that the program being added to
/// the router is both Upgradable (via Loader V3) and has the Upgrade authority 
/// set to the router PDA address.
///
/// # Arguments
/// * `ctx` - The AddVerifier context containing validated accounts
/// * `selector` - The selector to associate with this verifier 
///                (must be one higher then the current verifier count)
///
/// # Returns
/// * `Ok(())` if the verifier is successfully added
/// * `Err(RouterError::SelectorInvalid)` if the selector is invalid (not exactly one greater
///                                       then current verifier count)
/// * `Err(RouterError::VerifierInvalidAuthority)` if the router PDA is not the upgrade authority
/// * `Err(RouterError::Overflow)` if adding the verifier would overflow the counter (highly unlikely)
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

/// Verifies a zero-knowledge proof using the specified verifier
///
/// Routes the verification request to the appropriate verifier program
/// based on the selector.
///
/// # Arguments
/// * `ctx` - The Verify context containing validated accounts
/// * `proof` - The proof to be verified
/// * `image_id` - The image ID associated with the proof
/// * `journal_digest` - The journal digest for verification
///
/// # Returns
/// * `Ok(())` if the verification is successful
/// * `Err` if verification fails or the verifier returns an error
pub fn verify(
   ctx: Context<Verify>,
   proof: Proof,
   image_id: [u8; 32],
   journal_digest: [u8; 32],
) -> Result<()> {
    let verifier_program = ctx.accounts.verifier_program.to_account_info();
    let verifier_accounts = VerifyProof { 
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let verify_ctx = CpiContext::new(verifier_program, verifier_accounts);
    groth_16_verifier::cpi::verify(verify_ctx, proof, image_id, journal_digest)
}