// Anchor uses an old version of Borsh 0.10.3 make sure your project
// uses this version for compatibility in anchor
use borsh::{BorshDeserialize, BorshSerialize};

// This is where we define data that will be shared between our
// host program, our guest program, and our Solana on chain program.
#[derive(Debug, BorshSerialize, BorshDeserialize, Clone, Hash)]
pub struct IncrementNonceArguments {
    pub account: [u8; 32],
    pub nonce: u32,
}
