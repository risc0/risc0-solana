use risc0_zkvm::guest::env;

fn main() {
    // read the input
    let input: u32 = env::read();

    // write public output to the journal
    env::commit(&input);
}
