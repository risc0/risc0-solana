use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use groth_16_verifier::cpi::accounts::VerifyProof;
use groth_16_verifier::Proof;
pub mod events;
use crate::state::{VerifierEntry, VerifierRouter};
use crate::RouterError;
use events::EmergencyStopEvent;

use anchor_lang::solana_program::bpf_loader_upgradeable;

/// Account validation for emergency stop operations
///
/// Validates accounts needed for stopping a verifier and closing its accounts.
/// Can be triggered by owner or with a valid proof of exploit.
///
/// # Arguments
/// * `selector` - A u32 that uniquely identifies the verifier to stop
#[derive(Accounts)]
#[instruction(selector: u32)]
pub struct EmergencyStop<'info> {
    /// The router account PDA managing verifiers and required Upgrade Authority address of verifier
    #[account(
        mut,
        seeds = [b"router"],
        bump
    )]
    pub router: Account<'info, VerifierRouter>,

    /// The verifier entry of the program to be stopped.
    /// This entry will be closed and refunded to the caller on successful stop
    #[account(
        mut,
        seeds = [
            b"verifier",
            &selector.to_le_bytes()
        ],
        bump,
        constraint = verifier_entry.selector == selector,
        constraint = verifier_entry.verifier == verifier_program.key(),
        close = authority
    )]
    pub verifier_entry: Account<'info, VerifierEntry>,

    /// The authority attempting the emergency stop (either the router owner OR the person presenting proof of exploit)
    /// The authority will get the rent refund of both the program account of the verifier and the verifierEntry account
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The program account of the verifier to be used Address is verified against VerifierEntry
    /// Must be Unchecked as there could be any program ID here.
    /// This account will be closed by a CPI call to the Loader V3 and rent refunded to the authority
    /// CHECK: This program is deployed and checked against our PDA entries
    #[account(
        mut,
        executable,
        constraint = verifier_program.key() == verifier_entry.verifier @ RouterError::InvalidVerifier)
        ]
    pub verifier_program: UncheckedAccount<'info>,

    /// The Program Data account of the verifier to be closed
    #[account(
        mut,
        seeds = [
            verifier_program.key().as_ref()
        ],
        bump,
        seeds::program = bpf_loader_upgradeable::ID,
    )]
    pub verifier_program_data: Account<'info, ProgramData>,

    /// This is the Loader V3 BPF Upgrade program, Not written in Anchor so we cannot use the
    /// CPI extensions to automatically generate a secure CPI call and must do so manually
    /// CHECK: Verify the program address matches the known Loader V3 Program Address
    #[account(constraint = bpf_loader_upgradable_program.key() == bpf_loader_upgradeable::ID)]
    pub bpf_loader_upgradable_program: UncheckedAccount<'info>,

    /// Required because we are closing accounts
    pub system_program: Program<'info, System>,
}

/// # WARNING: IRREVERSIBLE ACTION
/// Calling E-Stop on a Verifier will close the program account,
/// close the VerifierEntry Account and permanently disable the
/// verifier selector associated with the E-Stop'd Program. If successfully
/// called there is no way to re-enable a stopped selector, make sure you really
/// want to do this.
///
/// Executes an emergency stop of a verifier by the owner
///
/// Closes the verifier entry and program accounts, preventing further use.
/// Can only be called by the router's owner. The caller of this function gets
/// the rent refund.
///
/// # Arguments
/// * `ctx` - The EmergencyStop context containing validated accounts
/// * `selector` - The selector of the verifier to stop
///
/// # Returns
/// * `Ok(())` if the emergency stop is successful
pub fn emergency_stop_by_owner(ctx: Context<EmergencyStop>, selector: u32) -> Result<()> {
    // Verify the caller is Contract Owner
    ctx.accounts
        .router
        .ownership
        .assert_owner(&ctx.accounts.authority)?;

    close_verifier(
        &ctx.accounts.router,
        ctx.bumps.router,
        &ctx.accounts.authority,
        &ctx.accounts.verifier_program,
        &ctx.accounts.verifier_program_data,
        &ctx.accounts.bpf_loader_upgradable_program,
    )?;

    emit!(EmergencyStopEvent {
        router: ctx.accounts.router.key(),
        selector,
        verifier: ctx.accounts.verifier_entry.verifier,
        triggered_by: ctx.accounts.authority.key(),
        reason: "Owner has revoked the verifier.".to_string()
    });

    Ok(())
}

/// Closes a verifier program by closing its program data account
///
/// Internal function used by emergency stop operations to close a verifier's
/// program data account and transfer the rent to a recipient.
///
/// # Arguments
/// * `router` - The router account managing the verifiers and the upgrade authority of the verifier
/// * `router_bumps` - Bump seed for the router's PDA
/// * `recipient` - Account that will receive the returned rent
/// * `verifier_program` - The program account of the verifier being closed
/// * `verifier_program_data` - The program data account of the verifier being closed
/// * `loader_v3` - The BPF loader program account
///
/// # Returns
/// * `Ok(())` if the verifier is successfully closed
/// * `Err` if the CPI to close the program fails
///
/// # Security Considerations
/// * Only callable by emergency stop functions
/// * Requires router signer seeds for CPI authorization
/// * Transfers rent to the specified recipient
fn close_verifier<'info>(
    router: &Account<'info, VerifierRouter>,
    router_bumps: u8,
    recipient: &Signer<'info>,
    verifier_program: &UncheckedAccount<'info>,
    verifier_program_data: &Account<'info, ProgramData>,
    loader_v3: &UncheckedAccount<'info>,
) -> Result<()> {
    let router_seed = &[b"router".as_ref(), &[router_bumps]];

    let close_instruction = bpf_loader_upgradeable::close_any(
        &verifier_program_data.key(),
        &recipient.key(),
        Some(&router.key()),
        Some(&verifier_program.key()),
    );

    invoke_signed(
        &close_instruction,
        &[
            verifier_program_data.to_account_info(),
            recipient.to_account_info(),
            router.to_account_info(),
            verifier_program.to_account_info(),
            loader_v3.to_account_info(),
        ],
        &[router_seed],
    )?;

    Ok(())
}

/// Executes an emergency stop of a verifier using a proof of exploit
///
/// Allows anyone to stop a verifier by providing a valid proof of exploitation.
/// The caller of this function gets the rent refund.
///
/// # Notice:
///
/// If you have identified a vulnerability in any of our verifiers and are able to
/// craft a malicious proof *please* construct a proof that verifies with a null
/// image id and has a null journal digest and submit it to this function which will
/// immediately disable the verifier from future use.
///
/// If you believe you have identified a vulnerability and are unable to submit an
/// invalid proof please contact the RISC Zero team immediately if possible.
///
/// # Arguments
/// * `ctx` - The EmergencyStop context containing validated accounts
/// * `selector` - The selector of the verifier to stop
/// * `proof` - The proof demonstrating the exploit
/// * `image_id` - The image ID associated with the proof
/// * `journal_digest` - The journal digest for verification
///
/// # Returns
/// * `Ok(())` if the emergency stop is successful
/// * `Err(EstopError::InvalidProofOfExploit)` if the proof is invalid
pub fn emergency_stop_with_proof(
    ctx: Context<EmergencyStop>,
    selector: u32,
    proof: Proof,
) -> Result<()> {
    let zero_array = [0u8; 32];

    // Attempt to verify the proof
    let verifier_program = ctx.accounts.verifier_program.to_account_info();
    let verifier_accounts = VerifyProof {
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let verify_ctx = CpiContext::new(verifier_program, verifier_accounts);
    let _ = groth_16_verifier::cpi::verify(verify_ctx, proof, zero_array, zero_array);

    close_verifier(
        &ctx.accounts.router,
        ctx.bumps.router,
        &ctx.accounts.authority,
        &ctx.accounts.verifier_program,
        &ctx.accounts.verifier_program_data,
        &ctx.accounts.bpf_loader_upgradable_program,
    )?;

    emit!(EmergencyStopEvent {
        router: ctx.accounts.router.key(),
        selector,
        verifier: ctx.accounts.verifier_entry.verifier,
        triggered_by: ctx.accounts.authority.key(),
        reason: "Invalid Proof was demonstrated, verifier compromised.".to_string()
    });

    Ok(())
}
