use anchor_lang::prelude::*;

#[error_code]
pub enum VerifierError {
    #[msg("G1 compression error")]
    G1CompressionError,
    #[msg("G2 compression error")]
    G2CompressionError,
    #[msg("Verification error")]
    VerificationError,
    #[msg("Invalid public input")]
    InvalidPublicInput,
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Pairing error")]
    PairingError,
}
