import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import fs from "mz/fs";
import path from "path";

// Constants
const PROGRAM_KEYPAIR_PATH = path.resolve(
  __dirname,
  "../../../target/deploy/program-keypair.json"
);
const CONNECTION_URL = "http://127.0.0.1:8899";
const COMPUTE_UNITS = 1400000;
const COMPRESSED_PROOF_PATH = path.resolve(__dirname, "../../../test/data/compressed_proof.bin");
console.log(COMPRESSED_PROOF_PATH);

async function main() {
  console.log("Launching client...");

  const connection = new Connection(CONNECTION_URL, "confirmed");

  // Load program keypair
  const secretKeyString = await fs.readFile(PROGRAM_KEYPAIR_PATH, {
    encoding: "utf8",
  });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const programKeypair = Keypair.fromSecretKey(secretKey);
  const programId = programKeypair.publicKey;

  // Generate a new keypair for the transaction
  const triggerKeypair = Keypair.generate();
  const airdropRequest = await connection.requestAirdrop(
    triggerKeypair.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropRequest);

  console.log("--Pinging Program ", programId.toBase58());

  // Read the compressed proof from the file
  const proof = await fs.readFile(COMPRESSED_PROOF_PATH);

  console.log(`Compressed proof length: ${proof.length}`);

  // Create a transaction instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: triggerKeypair.publicKey, isSigner: true, isWritable: true },
    ],
    programId,
    data: proof,
  });

  // Create a transaction
  const transaction = new Transaction();

  // Add ComputeBudgetProgram instruction to set the compute unit limit
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: COMPUTE_UNITS,
  });
  transaction.add(computeBudgetIx);

  // Add the main instruction to the transaction
  transaction.add(instruction);

  // Send and confirm the transaction
  await sendAndConfirmTransaction(connection, transaction, [triggerKeypair]);

  console.log("Transaction confirmed");
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);

