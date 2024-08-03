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
import { variant, serialize, } from "@dao-xyz/borsh";

const PROGRAM_KEYPAIR_PATH = path.resolve(
  __dirname,
  "../../../target/deploy/program-keypair.json"
);
const CONNECTION_URL = "http://127.0.0.1:8899";
const COMPUTE_UNITS = 1400000;
const COMPRESSED_PROOF_PATH = path.resolve(__dirname, "../../../test/data/compressed_proof.bin");

@variant(0)
class InitializeVerifyingKey {
  constructor() {}
}

@variant(1)
class VerifyProof {
  constructor() {}
}

type InstructionType = InitializeVerifyingKey | VerifyProof;

function serializeInstruction(instruction: InstructionType): Buffer {
  return Buffer.from(serialize(instruction));
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

async function initializeVerifyingKey(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey
): Promise<Keypair> {
  const vkAccountKeypair = Keypair.generate();
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: vkAccountKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(1024),
    space: 840,
    programId: programId,
  });

  const initializeVkInstruction = new TransactionInstruction({
    keys: [
      { pubkey: vkAccountKeypair.publicKey, isSigner: false, isWritable: true },
    ],
    programId,
    data: serializeInstruction(new InitializeVerifyingKey()),
  });

  const transaction = new Transaction().add(
    createAccountInstruction,
    initializeVkInstruction
  );
  await sendAndConfirmTransaction(connection, transaction, [payer, vkAccountKeypair]);
  console.log("--Verifying key account initialized", programId.toBase58());
  return vkAccountKeypair;
}

async function verifyProof(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey,
  vkAccount: Keypair
): Promise<void> {
  const proof = await fs.readFile(COMPRESSED_PROOF_PATH);

  const verifyProofInstruction = new TransactionInstruction({
    keys: [
      { pubkey: vkAccount.publicKey, isSigner: false, isWritable: false },
    ],
    programId,
    data: Buffer.concat([serializeInstruction(new VerifyProof()), proof]),
  });

  const transaction = new Transaction();
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: COMPUTE_UNITS,
  });
  transaction.add(computeBudgetIx, verifyProofInstruction);

  await sendAndConfirmTransaction(connection, transaction, [payer]);
  console.log("--Proof verification transaction confirmed", programId.toBase58());
}

async function main() {
  console.log("Launching client...");
  const connection = await initConnection();
  const programId = await loadProgramId();
  const payer = await createPayerAccount(connection);

  console.log("--Pinging Program ", programId.toBase58());

  console.log("--Setting Verification Key ", programId.toBase58());
  const vkAccount = await initializeVerifyingKey(connection, payer, programId);
  console.log("--Verifying Proof", programId.toBase58());
  await verifyProof(connection, payer, programId, vkAccount);
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);

