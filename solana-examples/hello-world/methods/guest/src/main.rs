use borsh::{BorshDeserialize, BorshSerialize};
use risc0_zkvm::guest::env;
use shared::IncrementNonceArguments;

fn main() {
    // read the input, we use the stdin reader since we are using borsh (more common on solana) then Serde which is built into
    // the env::read option
    let mut inputs = IncrementNonceArguments::deserialize_reader(&mut env::stdin()).unwrap();

    // Increment the nonce
    inputs.nonce = inputs.nonce + 1;

    // Our proof very simply deserializes then re-serializes the value
    inputs.serialize(&mut env::journal()).unwrap();
}
