use anchor_lang::prelude::*;

/// Error codes specific to emergency stop operations
///
/// # Variants
/// * `InvalidProofOfExploit` - Returned when a provided proof of invalid behavior fails verification
#[error_code]
pub enum EstopError {
    #[msg("Invalid proof of exploit")]
    InvalidProofOfExploit,
}
