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
async function generatePublicInputs(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey
): Promise<Keypair> {
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
  console.log("Claim digest length:", claimDigest.length);
  console.log("Claim digest:", claimDigest.toString('hex'));

  if (claimDigest.length !== 32) {
    throw new Error(`Invalid claim digest length: ${claimDigest.length}. Expected 32 bytes.`);
  }

  const instructionData = Buffer.concat([
    Buffer.from([InstructionType.GenPublicInputs]), 
    claimDigest
  ]);
  console.log("Instruction data length:", instructionData.length);
  console.log("Instruction data:", instructionData.toString('hex'));

  const genPublicInputsInstruction = new TransactionInstruction({
    keys: [
      { pubkey: publicInputsAccountKeypair.publicKey, isSigner: false, isWritable: true },
    ],
    programId,
    data: instructionData,
  });

  const transaction = new Transaction().add(
    createAccountInstruction,
    genPublicInputsInstruction
  );

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer, publicInputsAccountKeypair], {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
    });
    console.log("Transaction signature:", signature);
    console.log("--Public inputs generated", publicInputsAccountKeypair.publicKey.toBase58());

    const transactionDetails = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    console.log("Transaction details:", JSON.stringify(transactionDetails, null, 2));

  } catch (error) {
    console.error("Error generating public inputs:", error);
    if (error instanceof Error && 'logs' in error) {
      console.error("Transaction logs:", (error as any).logs);
    }
    throw error;
  }

  return publicInputsAccountKeypair;
}


async function verifyProof(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey,
  publicInputsAccount: Keypair
): Promise<void> {
  const proof = await fs.readFile(COMPRESSED_PROOF_PATH);

  const verifyProofInstruction = new TransactionInstruction({
    keys: [
      { pubkey: publicInputsAccount.publicKey, isSigner: false, isWritable: false },
    ],
    programId,
    data: Buffer.concat([serializeInstruction(InstructionType.VerifyProof), proof]),
  });

  const transaction = new Transaction();
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: COMPUTE_UNITS,
  });
  transaction.add(computeBudgetIx, verifyProofInstruction);

  try {
    await sendAndConfirmTransaction(connection, transaction, [payer], {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
    });
    console.log("--Proof verification transaction confirmed");
  } catch (error) {
    console.error("Error verifying proof:", error);
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
    console.log("--Generating Public Inputs");
    const publicInputsAccount = await generatePublicInputs(connection, payer, programId);
    
    console.log("--Verifying Proof");
    await verifyProof(connection, payer, programId, publicInputsAccount);
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