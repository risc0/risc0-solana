use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use groth_16_verifier::cpi::accounts::VerifyProof;
use groth_16_verifier::Proof;
pub mod errors;
pub mod events;
use crate::state::{VerifierEntry, VerifierRouter};
use crate::RouterError;
use errors::EstopError;
use events::EmergencyStopEvent;

use anchor_lang::solana_program::bpf_loader_upgradeable;

#[derive(Accounts)]
#[instruction(selector: u32)]
pub struct EmergencyStop<'info> {
    /// The router account containing ownership and verifier registry
    #[account(
        mut,
        seeds = [b"router"],
        bump
    )]
    pub router: Account<'info, VerifierRouter>,

    /// The verifier entry to be closed
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

    /// The authority attempting the emergency stop
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The program account of the verifier to be used
    /// Address is verified against VerifierEntry
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

    /// CHECK: This is the BPF Loader for calling close
    #[account(constraint = bpf_loader_upgradable_program.key() == bpf_loader_upgradeable::ID)]
    pub bpf_loader_upgradable_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

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

pub fn emergency_stop_with_proof(
    ctx: Context<EmergencyStop>,
    selector: u32,
    proof: Proof,
    image_id: [u8; 32],
    journal_digest: [u8; 32],
) -> Result<()> {
    let zero_array = [0u8; 32];

    msg!("Emergency Stop With Proof Reached!");
    require!(
        image_id == zero_array && journal_digest == zero_array,
        EstopError::InvalidProofOfExploit
    );
    msg!("Proof requirements Passed!");

    // Attempt to verify the proof
    let verifier_program = ctx.accounts.verifier_program.to_account_info();
    let verifier_accounts = VerifyProof {
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    msg!("Making CPI call to verifier");
    let verify_ctx = CpiContext::new(verifier_program, verifier_accounts);
    let _ = groth_16_verifier::cpi::verify(verify_ctx, proof, image_id, journal_digest);

    msg!("Call did pass");
    let router_seed = &[b"router".as_ref(), &[ctx.bumps.router]];
    msg!(
        "Router Seed: {:?} & Bumps: {} ",
        router_seed,
        ctx.bumps.router
    );

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
