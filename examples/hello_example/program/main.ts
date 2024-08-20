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

import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  SystemProgram,
  PublicKey,
} from "@solana/web3.js";
import fs from "mz/fs";
import path from "path";

const PROGRAM_KEYPAIR_PATH = path.resolve(
  __dirname,
  "../../../target/deploy/program-keypair.json"
);
const CONNECTION_URL = "http://127.0.0.1:8899";
const COMPUTE_UNITS = 1400000;
const COMPRESSED_PROOF_PATH = path.resolve(__dirname, "../../../test/data/compressed_proof.bin");
const CLAIM_DIGEST_PATH = path.resolve(__dirname, "../../../test/data/claim_digest.bin");
enum InstructionType {
  VerifyProof = 0,
  GenPublicInputs = 1,
}

function serializeInstruction(instruction: InstructionType): Buffer {
  return Buffer.from([instruction]);
}

async function initConnection(): Promise<Connection> {
  return new Connection(CONNECTION_URL, "confirmed");
}

async function loadProgramId(): Promise<PublicKey> {
  const secretKeyString = await fs.readFile(PROGRAM_KEYPAIR_PATH, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const programKeypair = Keypair.fromSecretKey(secretKey);
  return programKeypair.publicKey;
}

async function createPayerAccount(connection: Connection): Promise<Keypair> {
  const payerKeypair = Keypair.generate();
  const airdropRequest = await connection.requestAirdrop(
    payerKeypair.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropRequest);
  return payerKeypair;
}

async function verify_proof(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey
): Promise<void> {
  const publicInputsAccountKeypair = Keypair.generate();
  const space = 160; // 5 * 32 bytes for public inputs
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: publicInputsAccountKeypair.publicKey,
    lamports,
    space,
    programId,
  });

  const claimDigest = await fs.readFile(CLAIM_DIGEST_PATH);
  const compressedProof = await fs.readFile(COMPRESSED_PROOF_PATH);

  const instructionData = Buffer.concat([
    Buffer.from([0]), // Instruction index for GenAndVerify
    claimDigest,
    compressedProof
  ]);

  const genAndVerifyInstruction = new TransactionInstruction({
    keys: [
      { pubkey: publicInputsAccountKeypair.publicKey, isSigner: false, isWritable: true },
    ],
    programId,
    data: instructionData,
  });

  const transaction = new Transaction().add(
    createAccountInstruction,
    genAndVerifyInstruction
  );

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer, publicInputsAccountKeypair], {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
    });
    console.log("Transaction signature:", signature);
    console.log("Proof verified!");
  } catch (error) {
    console.error("Error in generate and verify operation:", error);
    throw error;
  }
}

async function main() {
  console.log("Launching client...");
  const connection = await initConnection();
  const programId = await loadProgramId();
  const payer = await createPayerAccount(connection);

  console.log("--Pinging Program ", programId.toBase58());

  try {
    console.log("-- Verifying Proof");
    await verify_proof(connection, payer, programId);
  } catch (error) {
    console.error("Error in main execution:", error);
  }
}



main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);