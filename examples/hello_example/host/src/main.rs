// Copyright 2024 RISC Zero, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::{
    fs::{self, File},
    io::Write,
    path::Path,
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
        .expect("Failed to write input")
        .build()
        .expect("Failed to build ExecutorEnv");

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

    let dir_path = &format!(
        "{}/../../../test/data/receipt.json",
        env!("CARGO_MANIFEST_DIR")
    );
    if !Path::new(dir_path).exists() {
        fs::create_dir_all(dir_path).unwrap();
    }

    let mut file = File::create(dir_path).unwrap();

    // Write the data
    file.write_all(&receipt_json).unwrap();

    let _output: u32 = receipt.journal.decode().expect("failed to decode");

    receipt.verify(EXAMPLE_ID).unwrap();
}
