// Copyright 2025 RISC Zero, Inc.
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
//
// SPDX-License-Identifier: Apache-2.0

use anchor_client::anchor_lang::system_program::ID as SYSTEM_PROGRAM_ID;
use anchor_client::solana_client::rpc_config::RpcRequestAirdropConfig;
use anchor_client::solana_sdk::{
    commitment_config::{CommitmentConfig, CommitmentLevel},
    pubkey::Pubkey,
};
use anchor_client::Program;
use anchor_client::{
    solana_sdk::{signature::Keypair, signer::Signer},
    Client, Cluster,
};
use borsh::to_vec;
use groth_16_verifier::client::receipt_to_proof;
use risc0_zkvm::sha::Digestible;
use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts};
use solana_examples::{accounts, instruction, ProgramData};
use std::sync::Arc;
use tracing::{debug, info, trace};

// These constants represent the RISC-V ELF and the image ID generated by risc0-build.
// The ELF is used for proving and the ID is used for verification.
use methods::{HELLO_GUEST_ELF, HELLO_GUEST_ID};

// A shared library that contains the inputs / outputs of our guest
use shared::IncrementNonceArguments;

type PROGRAM = Program<Arc<Keypair>>;

const SELECTOR: u32 = 1; // Going to assume only one verifier in our test

/// Converts a RISC Zero image ID from [u32; 8] format to [u8; 32] format.
///
/// This conversion is necessary because RISC Zero generates image IDs as 8 32-bit integers,
/// but the Solana verifier expects a 32-byte array.
///
/// # Arguments
///
/// * `input` - The RISC Zero image ID as [u32; 8]
///
/// # Returns
///
/// * `[u8; 32]` - The converted image ID as a 32-byte array
fn convert_array(input: [u32; 8]) -> [u8; 32] {
    let bytes: Vec<u8> = input.iter().flat_map(|&x| x.to_le_bytes()).collect();
    bytes.try_into().unwrap()
}

/// Initializes the Solana program by setting up its data account.
///
/// This function creates and initializes the program data account with:
/// - Initial nonce value of 0
/// - Specified image ID from the RISC Zero Guest ID
/// - Selector for the verifier router
///
/// # Notice
///
/// This function can only be called once, if the program data has been previously initialized
/// it will panic.
///
/// # Arguments
///
/// * `user` - Keypair used for signing the initialization transaction and paying rent
/// * `example_program` - Address to the deployed Solana program
/// * `program_data_address` - PDA address where program data will be stored
///
/// # Panics
///
/// This function will panic if:
/// - Account already exists
/// - Transaction submission fails
/// - Insufficient balance for account creation
async fn init(user: Arc<Keypair>, example_program: &PROGRAM, program_data_address: Pubkey) {
    info!("Attempting to initialize program data");

    example_program
        .request()
        .accounts(accounts::Initialize {
            authority: user.pubkey(),
            program_data: program_data_address,
            system_program: SYSTEM_PROGRAM_ID,
        })
        .args(instruction::Initialize {
            image_id: convert_array(HELLO_GUEST_ID),
            selector: SELECTOR,
        })
        .payer(user.clone())
        .signer(&user)
        .send()
        .await
        .expect("Was unable to submit the initialization transaction");

    info!("Transaction Successful, our program is initialized and now ready for verifying proofs");
}

/// Increments the program's nonce value by generating and submitting a zero-knowledge proof.
///
/// This function:
/// 1. Reads current nonce from program data on the Solana blockchain
/// 2. Generates a ZK proof from the guest program
/// 3. Submits the proof to the example Solana program for verification
///
/// # Arguments
///
/// * `user` - Keypair used for signing transactions
/// * `example_program` - Address to the deployed Solana example program
/// * `program_data_address` - PDA Address of the program's data account from the Solana example program
///
/// # Panics
///
/// This function will panic if:
/// - Its unable to fetch current program data from the program_data_address
/// - Proof generation fails
/// - Transaction submission fails
/// - Proof verification fails on-chain
async fn increment_nonce(
    user: Arc<Keypair>,
    example_program: PROGRAM,
    program_data_address: Pubkey,
) {
    info!("Attempting to increment program nonce");

    let program_data: ProgramData = example_program
        .account(program_data_address)
        .await
        .expect("Was unable to find program data account for example");

    let nonce: u32 = program_data.nonce;

    info!("Current Nonce value is {nonce}");

    let nonce_arguments = IncrementNonceArguments {
        account: user.pubkey().to_bytes(),
        nonce,
    };

    // We serialize with Borsh to get a format that is more commonly used in Solana
    let input = to_vec(&nonce_arguments).expect("Could not serialize proof nonce arguments");

    let receipt = tokio::task::spawn_blocking(move || {
        let prover = default_prover();
        let env = ExecutorEnv::builder().write_slice(&input).build().unwrap();
        let prover_options = ProverOpts::groth16();
        let prove_info = prover
            .prove_with_opts(env, HELLO_GUEST_ELF, &prover_options)
            .unwrap();
        prove_info.receipt
    })
    .await
    .expect("Proving task failed");

    let journal_digest = receipt.journal.digest();

    debug!("Journal digest is {journal_digest:?}");

    info!("Groth 16 proof for nonce increment transaction successfully created, submitting transaction to the program.");

    let groth16_receipt = receipt
        .inner
        .groth16()
        .expect("Unable to get Groth 16 proof from main receipt");

    let proof =
        receipt_to_proof(groth16_receipt).expect("Unable to generate proof from Groth Receipt");

    let (router_pda_address, _) = Pubkey::find_program_address(&[b"router"], &verifier_router::ID);
    debug!("Using the address: {router_pda_address} as the Router Account");

    // Get the verifier entry account address
    let (verifier_entry_address, _) = Pubkey::find_program_address(
        &[b"verifier", &SELECTOR.to_le_bytes()],
        &verifier_router::ID,
    );

    let output = receipt.journal.bytes;

    debug!("Using the address: {verifier_entry_address} as the Verifier Entry Account");

    example_program
        .request()
        .accounts(accounts::IncrementNonce {
            program_data: program_data_address,
            router: verifier_router::ID,
            router_account: router_pda_address,
            prover: user.pubkey(),
            verifier_entry: verifier_entry_address,
            system_program: SYSTEM_PROGRAM_ID,
            verifier_program: groth_16_verifier::ID,
        })
        .args(instruction::IncrementNonce {
            journal_outputs: output,
            proof: proof,
        })
        .signer(&user)
        .send()
        .await
        .expect("Unable to send increment nonce transaction");

    info!("Transaction successfully completed, nonce incremented");
}

/// Main entry point for the host program that demonstrates zero-knowledge proof integration with Solana.
///
/// The program will:
/// - Create a new keypair for transactions
/// - Request an airdrop
/// - Wait for airdrop confirmation
/// - Initialize program data if it doesn't exist
/// - Execute nonce increment with proof verification
///
/// # Panics
///
/// Will panic if:
/// - Unable to connect to Solana cluster
/// - Airdrop request fails
/// - Program initialization fails
/// - Proof generation or verification fails
///
/// # Environment
///
/// Requires:
/// - Local Solana validator running
/// - Verifier router program deployed
/// - Example program deployed
/// - RUST_LOG environment variable for logging (optional)
#[tokio::main]
async fn main() {
    // Initialize tracing. In order to view logs, run `RUST_LOG=info cargo run`
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    info!("Example RISC Zero Solana Program has started!");

    // Construct a new user and request solana for the transaction
    let user = Arc::new(Keypair::new());
    let user_address = user.pubkey();
    debug!("Generated a keypair for this transaction: {user:?}");
    let client = Client::new(Cluster::Localnet, user.clone());

    debug!("Airdrop was completed for address: {user_address}");

    let solana_example_address = solana_examples::ID;
    debug!("Interacting with solana example program at address: {solana_example_address}");

    let example_program = client
        .program(solana_examples::ID)
        .expect("Was unable to construct a client for the solana program on localnet.");

    let (program_data_address, _) = Pubkey::find_program_address(&[b"data"], &solana_examples::ID);

    debug!("Account Program Data PDA Address is: {program_data_address}");

    let rpc = example_program.async_rpc();

    let latest_blockhash = rpc
        .get_latest_blockhash()
        .await
        .expect("Could not get latest blockhash");

    rpc.request_airdrop_with_config(
        &user_address,
        5000000000,
        RpcRequestAirdropConfig {
            recent_blockhash: Some(latest_blockhash.to_string()),
            commitment: Some(CommitmentConfig {
                commitment: CommitmentLevel::Finalized,
            }),
        },
    )
    .await
    .expect("Was unable to request airdrop on localnet testnet.");

    info!("Going to loop until we have received balance from airdrop!");

    loop {
        let balance_result = rpc.get_balance(&user_address).await;
        if let Ok(balance) = balance_result {
            trace!("Balance is: {balance}");
            if balance > 0 {
                break;
            } else {
                debug!("Was unable to fetch balance for user account");
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Check if the contract has been initialized yet
    let program_data: Result<ProgramData, _> = example_program.account(program_data_address).await;

    if program_data.is_err() {
        info!("Could not find program data account, could be first run, initializing program!");
        init(user.clone(), &example_program, program_data_address).await;
    }
    increment_nonce(user, example_program, program_data_address).await
}
