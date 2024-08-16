use std::{
    fs::{self, File},
    io::Write,
};

use methods::{EXAMPLE_ELF, EXAMPLE_ID};
use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts, VerifierContext};

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    let input: u32 = 15 * u32::pow(2, 27) + 1;
    let env = ExecutorEnv::builder()
        .write(&input)
        .unwrap()
        .build()
        .unwrap();

    let receipt = default_prover()
        .prove_with_ctx(
            env,
            &VerifierContext::default(),
            EXAMPLE_ELF,
            &ProverOpts::groth16(),
        )
        .expect("failed to prove.")
        .receipt;

    let receipt_json = serde_json::to_vec(&receipt).unwrap();

    let dir_path = "../../../test/data/receipt.json";
    let _dir = fs::create_dir_all(dir_path).unwrap();

    let mut file = File::create(dir_path).unwrap();

    // Write the data
    file.write_all(&receipt_json).unwrap();

    let _output: u32 = receipt.journal.decode().unwrap();

    receipt.verify(EXAMPLE_ID).unwrap();
}
