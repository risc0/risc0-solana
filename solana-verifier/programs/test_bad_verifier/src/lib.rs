use anchor_lang::prelude::*;
use anchor_lang::system_program;
use groth_16_verifier::Proof;

declare_id!("H111vaTfs4ktTvJFqy46UFq5sjcEkixgmHwuHc6oabD8");

#[error_code]
pub enum VerifierError {
    #[msg("Verification Error")]
    VerificationError,
}

#[derive(Accounts)]
// Can't be empty when CPI is enabled see anchor #1628
pub struct VerifyProof<'info> {
    /// CHECK: Only included to satisfy Anchor CPI requirements
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[program]
pub mod test_bad_verifier {
    use super::*;

    /// # WARNING: DO NOT USE IN PRODUCTION ONLY FOR USE IN TESTS
    ///
    ///  Simple verifier that returns false for any proof except for a proof that has a null claim digest
    ///
    /// To produce a valid proof with this broken verifier send a proof for an empty claim digest where all proof
    /// values are as follows:
    ///  - pi_a = [0xCA; 64]
    ///  - pi_b = [0xFE; 128]
    ///  - pi_c = [0xCA; 64]
    ///
    /// All other proofs will be rejected by this verifier.
    pub fn verify(
        _ctx: Context<VerifyProof>,
        proof: Proof,
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        let empty_32: [u8; 32] = [0; 32];
        let empty_64: [u8; 64] = [0xCA; 64];
        let empty_128: [u8; 128] = [0xFE; 128];

        require!(image_id == empty_32, VerifierError::VerificationError);
        require!(journal_digest == empty_32, VerifierError::VerificationError);

        require!(proof.pi_a == empty_64, VerifierError::VerificationError);
        require!(proof.pi_b == empty_128, VerifierError::VerificationError);
        require!(proof.pi_c == empty_64, VerifierError::VerificationError);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
