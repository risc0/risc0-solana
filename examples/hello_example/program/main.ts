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
import { variant, serialize } from "@dao-xyz/borsh";

const PROGRAM_KEYPAIR_PATH = path.resolve(
  __dirname,
  "../../../target/deploy/program-keypair.json"
);
const CONNECTION_URL = "http://127.0.0.1:8899";
const COMPUTE_UNITS = 1400000;
const COMPRESSED_PROOF_PATH = path.resolve(__dirname, "../../../test/data/compressed_proof.bin");
const PUBLIC_INPUTS_PATH = path.resolve(__dirname, "../../../test/data/public_inputs.bin");

@variant(0)
class InitializeVerifyingKey {
  constructor() {}
}

@variant(1)
class InitializePublicInputs {
  constructor() {}
}

@variant(2)
class VerifyProof {
  constructor() {}
}

type InstructionType = InitializeVerifyingKey | InitializePublicInputs | VerifyProof;

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
): Promise<PublicKey> {
  const vkAccountSeed = "verification_key";
  const [vkAccountPubkey] = await PublicKey.findProgramAddress(
    [Buffer.from(vkAccountSeed)],
    programId
  );

  const space = 840; 
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: vkAccountPubkey,
    lamports,
    space,
    programId,
  });

  const initializeVkInstruction = new TransactionInstruction({
    keys: [
      { pubkey: vkAccountPubkey, isSigner: false, isWritable: true },
    ],
    programId,
    data: serializeInstruction(new InitializeVerifyingKey()),
  });

  const transaction = new Transaction().add(createAccountIx, initializeVkInstruction);
  
  try {
    await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log("--Verifying key account initialized", vkAccountPubkey.toBase58());
  } catch (error) {
    console.log(error);
      console.log("--Verifying key account already initialized", vkAccountPubkey.toBase58());

  }

  return vkAccountPubkey;
}

async function initializePublicInputs(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey
): Promise<Keypair> {
  const publicInputsAccountKeypair = Keypair.generate();
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: publicInputsAccountKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(160),
    space: 160,
    programId: programId,
  });

  const publicInputs = await fs.readFile(PUBLIC_INPUTS_PATH);

  const initializePublicInputsInstruction = new TransactionInstruction({
    keys: [
      { pubkey: publicInputsAccountKeypair.publicKey, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.concat([serializeInstruction(new InitializePublicInputs()), publicInputs]),
  });

  const transaction = new Transaction().add(
    createAccountInstruction,
    initializePublicInputsInstruction
  );
  await sendAndConfirmTransaction(connection, transaction, [payer, publicInputsAccountKeypair]);
  console.log("--Public inputs account initialized", publicInputsAccountKeypair.publicKey.toBase58());
  return publicInputsAccountKeypair;
}

async function verifyProof(
  connection: Connection,
  payer: Keypair,
  programId: PublicKey,
  vkAccountPubkey: PublicKey,
  publicInputsAccount: Keypair
): Promise<void> {
  const proof = await fs.readFile(COMPRESSED_PROOF_PATH);

  const verifyProofInstruction = new TransactionInstruction({
    keys: [
      { pubkey: vkAccountPubkey, isSigner: false, isWritable: false },
      { pubkey: publicInputsAccount.publicKey, isSigner: false, isWritable: false },
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
  console.log("--Proof verification transaction confirmed");
}

async function main() {
  console.log("Launching client...");
  const connection = await initConnection();
  const programId = await loadProgramId();
  const payer = await createPayerAccount(connection);

  console.log("--Pinging Program ", programId.toBase58());

  console.log("--Setting Verification Key");
  const vkAccountPubkey = await initializeVerifyingKey(connection, payer, programId);
  
  console.log("--Initializing Public Inputs");
  const publicInputsAccount = await initializePublicInputs(connection, payer, programId);
  
  console.log("--Verifying Proof");
  await verifyProof(connection, payer, programId, vkAccountPubkey, publicInputsAccount);
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);