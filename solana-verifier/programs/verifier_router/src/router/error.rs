use anchor_lang::prelude::*;

#[error_code]
pub enum RouterError {
    #[msg("Attempted to add a verifier contract that the router contract does not own and thus cannot delete")]
    VerifierInvalidAuthority,
    #[msg("Program provided account does not match the key in the verifier program data account")]
    VerifierInvalidLoader,
    #[msg("Selector is not valid for this call.")]
    SelectorInvalid,
    #[msg("Selector not found")]
    SelectorNotFound,
    #[msg("Selector has been deactivated")]
    SelectorDeactivated,
    #[msg("Invalid verifier program")]
    InvalidVerifier,
    #[msg("Arithmetic overflow")]
    Overflow,
}
