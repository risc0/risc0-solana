use anchor_lang::prelude::*;
use anchor_lang::AnchorDeserialize;
use borsh::BorshDeserialize;
use shared::IncrementNonceArguments;
use verifier_router::cpi::accounts::Verify;
use verifier_router::program::VerifierRouter as VerifierRouterProgram;
use verifier_router::router::Proof;
use verifier_router::state::{VerifierEntry, VerifierRouter};

declare_id!("J1VvJRzAXd7gHRdjz3rBEBZafwcJn3qzpKDjFU6yYuLj");

#[program]
pub mod solana_examples {
    use anchor_lang::solana_program::hash::hashv;

    use super::*;

    /// This allows us to initialize our program by setting the selector of the RISC Zero Router to use for
    /// proofs, the image_id of our own example program, and by setting the default value for our internal
    /// nonce. We may want to allow changing the selector so that we can use different verifiers in the future.
    /// The image ID is tightly coupled with our guest program and prevents a user from changing the off-chain
    /// executable code and still getting a valid transaction.
    pub fn initialize(ctx: Context<Initialize>, selector: u32, image_id: [u8; 32]) -> Result<()> {
        ctx.accounts.program_data.selector = selector;
        ctx.accounts.program_data.nonce = 0;
        ctx.accounts.program_data.image_id = image_id;
        Ok(())
    }

    /// This is the main function of the on chain portion of our example program,
    /// it takes a proof that someone has run our off chain program for the next nonce value.
    /// If the input they gave the off chain program was for an earlier or later nonce,
    /// the on chain program rejects the transaction. If it the proof is for incrementing to
    /// the next nonce and it was generated by a user who control the pubkey of the proof
    /// it accepts the transaction.
    pub fn increment_nonce(
        ctx: Context<IncrementNonce>,
        proof: Proof,
        journal_outputs: Vec<u8>,
    ) -> Result<()> {
        // We use Borsh to deserialize the data from the journal
        let journal_data: IncrementNonceArguments =
            BorshDeserialize::try_from_slice(&journal_outputs)?;

        // Next we want to check the conditions of the journal outputs match
        // whatever our programs needs to accept the transaction. In this case we verify that the proof generated is
        // of a nonce value one greater then the current one.
        require!(
            journal_data.nonce == ctx.accounts.program_data.nonce + 1,
            ExampleErrors::InvalidNonce
        );

        // We will also check that the account address of the nonce account matches the address signing the transaction
        require!(
            journal_data.account == ctx.accounts.prover.key().as_ref(),
            ExampleErrors::InvalidPubkey
        );

        // We hash our journal outputs to get a journal digest
        let journal_digest = hashv(&[journal_outputs.as_slice()]).to_bytes();

        // Next we collect the accounts necessary for making the CPI call to the RISC Zero Proof Verifier program
        let cpi_accounts = Verify {
            router: ctx.accounts.router_account.to_account_info(),
            verifier_entry: ctx.accounts.verifier_entry.to_account_info(),
            verifier_program: ctx.accounts.verifier_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        // We collect the image ID that our program is expecting our proof to match so that an attacker cannot use
        // a proof generated from a modified program
        let image_id = ctx.accounts.program_data.image_id;

        // We pass the selector for the proof verifier that we are currently using
        let selector = ctx.accounts.program_data.selector;

        // We setup our CPI context for the router
        let cpi_ctx = CpiContext::new(ctx.accounts.router.to_account_info(), cpi_accounts);

        // We make the CPI call to the RISC Zero Verifier Router which if it returns means the proof is valid
        // In Solana you cannot recover from a CPI call which returns an error, to make this clear I explicitly unwrap although
        // behavior would be the same if I ignored the result.
        verifier_router::cpi::verify(cpi_ctx, selector, proof, image_id, journal_digest).unwrap();

        // If we reached this line it means that our proof was valid and we modify the program state as appropriate
        ctx.accounts.program_data.nonce += 1;

        Ok(())
    }
}

/// Data account used for storing our current nonce value, the immutable image_id and verifier selector values
#[account]
pub struct ProgramData {
    pub selector: u32,
    pub nonce: u32,
    pub image_id: [u8; 32],
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"data"],
        bump,
        space = 8 + 4 + 4 + 32 // discriminator + selector + nonce + image_id
    )]
    pub program_data: Account<'info, ProgramData>,

    // Only used because we have to pay for rent for the account data
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IncrementNonce<'info> {
    #[account(mut)]
    pub program_data: Account<'info, ProgramData>,

    // The router program that will route to the correct verifier
    pub router: Program<'info, VerifierRouterProgram>,

    // The router account that will be used for routing our proof
    pub router_account: Account<'info, VerifierRouter>,

    // The PDA entry in the router that maps our selector to the actual verifier
    // TODO: Try chanigng to unchecked account because verifier checks the fields
    #[account(
        seeds = [
            b"verifier",
            &program_data.selector.to_le_bytes()
        ],
        bump,
        seeds::program = verifier_router::ID,
    )]
    pub verifier_entry: Account<'info, VerifierEntry>,

    pub prover: Signer<'info>,

    /// The actual Groth16 verifier program that will verify the proof
    /// CHECK: The verifier program checks are handled by the router program
    pub verifier_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ExampleErrors {
    #[msg("Invalid verifier selected")]
    InvalidVerifier,
    #[msg("Nonce is invalid for current transaction")]
    InvalidNonce,
    #[msg("Account pubkey from proof does not match pubkey of current journal output")]
    InvalidPubkey,
}

/// The event emitted when a user submits a valid transaction
/// showing who submitted the valid off chain proof and what
/// the new nonce value is for future runs
#[event]
pub struct SuccessfulIncrement {
    by: Pubkey,
    new_nonce: u32,
}
