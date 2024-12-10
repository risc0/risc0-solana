use anchor_lang::prelude::*;

/// Event emitted when an emergency stop is executed on a verifier
///
/// # Fields
/// * `router` - The public key of the router account managing the verifier
/// * `selector` - A u32 that uniquely identifies the verifier entry in the router
/// * `verifier` - The public key of the verifier program being emergency stopped
/// * `triggered_by` - The public key of the account that initiated the emergency stop
/// * `reason` - A string explaining why the emergency stop was triggered
#[event]
pub struct EmergencyStopEvent {
    pub router: Pubkey,
    pub selector: u32,
    pub verifier: Pubkey,
    pub triggered_by: Pubkey,
    pub reason: String,
}
