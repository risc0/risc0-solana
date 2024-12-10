use anchor_lang::prelude::*;
use ownable::*;
pub use OwnableError::*;

declare_id!("6K98qo8BZznst27ieMaCmTNZU7ryExBPgCKndZic8z5d");

#[account]
#[derive(Ownable)]
pub struct TestState {
    pub ownership: Ownership,
    pub data: u64,
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.state.ownership = Ownership::new(ctx.accounts.authority.key())?;
        Ok(())
    }

    pub fn transfer_ownership(
        ctx: Context<TestStateTransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        TestState::transfer_ownership(ctx, new_owner)
    }

    pub fn accept_ownership(ctx: Context<TestStateAcceptOwnership>) -> Result<()> {
        TestState::accept_ownership(ctx)
    }

    pub fn renounce_ownership(ctx: Context<TestStateRenounceOwnership>) -> Result<()> {
        TestState::renounce_ownership(ctx)
    }

    pub fn cancel_transfer(ctx: Context<TestStateCancelTransfer>) -> Result<()> {
        TestState::cancel_transfer(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 33 + 33 + 8
    )]
    pub state: Account<'info, TestState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
