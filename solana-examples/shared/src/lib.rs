use borsh::{BorshDeserialize, BorshSerialize};

// This is where we define data that will be shared between our
// host program, our guest program, and our Solana on chain program.
#[derive(Debug, BorshSerialize, BorshDeserialize, Clone, Hash)]
pub struct IncrementNonceArguments {
    pub account: [u8; 32],
    pub nonce: u32,
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;

    #[test]
    fn serialize_deserialize() {
        let nonce_arguments = IncrementNonceArguments {
            account: [0xCA; 32],
            nonce: 16,
        };
        println!("Current data as nonce_arguments: {nonce_arguments:#?}");
        let mut buffer = Vec::new();
        nonce_arguments.serialize(&mut buffer).unwrap();
        println!("Current buffer is {buffer:#?}");
        // Attempt to parse it out
        let journal_data: IncrementNonceArguments =
            BorshDeserialize::try_from_slice(&buffer).unwrap();

        println!("Current data in journal_data is: {journal_data:#?}");
    }
}
