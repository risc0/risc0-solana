use std::time::Duration;

use anyhow::Result;
use bonsai_sdk::alpha as bonsai_sdk;
use methods::{SOL_PROOF_ELF, SOL_PROOF_ID};
use risc0_zkvm::{compute_image_id, serde::to_vec, Receipt};
use std::fs::File;
use std::io::Write;

fn run_bonsai(input_data: Vec<u8>) -> Result<()> {
    let client = bonsai_sdk::Client::from_env(risc0_zkvm::VERSION)?;

    // Compute the image_id, then upload the ELF with the image_id as its key.
    let image_id = hex::encode(compute_image_id(SOL_PROOF_ELF)?);
    client.upload_img(&image_id, SOL_PROOF_ELF.to_vec())?;

    // Prepare input data and upload it.
    let input_data = to_vec(&input_data).unwrap();
    let input_data = bytemuck::cast_slice(&input_data).to_vec();
    let input_id = client.upload_input(input_data)?;

    // Add a list of assumptions
    let assumptions: Vec<String> = vec![];

    // Start a session running the prover
    let session = client.create_session(image_id, input_id, assumptions)?;
    loop {
        let res = session.status(&client)?;
        if res.status == "RUNNING" {
            eprintln!(
                "Current status: {} - state: {} - continue polling...",
                res.status,
                res.state.unwrap_or_default()
            );
            std::thread::sleep(Duration::from_secs(15));
            continue;
        }
        if res.status == "SUCCEEDED" {
            // Download the receipt, containing the output
            let receipt_url = res
                .receipt_url
                .expect("API error, missing receipt on completed session");

            let receipt_buf = client.download(&receipt_url)?;
            let receipt: Receipt = bincode::deserialize(&receipt_buf)?;
            receipt
                .verify(SOL_PROOF_ID)
                .expect("Receipt verification failed");
        } else {
            panic!(
                "Workflow exited: {} - | err: {}",
                res.status,
                res.error_msg.unwrap_or_default()
            );
        }

        break;
    }

    run_stark2snark(session.uuid)?;

    Ok(())
}

fn run_stark2snark(session_id: String) -> Result<()> {
    let client = bonsai_sdk::Client::from_env(risc0_zkvm::VERSION)?;

    let snark_session = client.create_snark(session_id)?;
    eprintln!("Created snark session: {}", snark_session.uuid);
    loop {
        let res = snark_session.status(&client)?;
        match res.status.as_str() {
            "RUNNING" => {
                eprintln!("Current status: {} - continue polling...", res.status,);
                std::thread::sleep(Duration::from_secs(15));
                continue;
            }
            "SUCCEEDED" => {
                let snark_receipt = res.output;
                eprintln!("Snark proof!: {snark_receipt:?}");
                // Write snark to file
                let json_str = serde_json::to_string_pretty(&snark_receipt)?;
                let mut file = File::create("receipt.json")?;
                let _ = file.write_all(json_str.as_bytes());

                break;
            }
            _ => {
                panic!(
                    "Workflow exited: {} err: {}",
                    res.status,
                    res.error_msg.unwrap_or_default()
                );
            }
        }
    }
    Ok(())
}

fn main() {
    // Initialize tracing. In order to view logs, run `RUST_LOG=info cargo run`
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    let input: u32 = 15 * u32::pow(2, 27) + 1;

    let input_data = input.to_le_bytes().to_vec();

    run_bonsai(input_data).unwrap();
}
