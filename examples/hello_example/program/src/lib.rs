use borsh::{BorshDeserialize, BorshSerialize};
use risc0_solana::{decompress_g1, decompress_g2, public_inputs, Proof, VerificationKey, Verifier};
use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg,
    program_error::ProgramError, pubkey::Pubkey,
};

entrypoint!(process_instruction);

// From: https://github.com/risc0/risc0/blob/55b45e8d11d80a1711441051929ec15294cd61c1/risc0/circuit/recursion/src/control_id.rs#L49
const ALLOWED_CONTROL_ROOT: &str =
    "a516a057c9fbf5629106300934d48e0e775d4230e41e503347cad96fcbde7e2e";
const BN254_IDENTITY_CONTROL_ID: &str =
    "51b54a62f2aa599aef768744c95de8c7d89bf716e11b1179f05d6cf0bcfeb60e";

const VERIFYING_KEY: VerificationKey = VerificationKey {
    nr_pubinputs: 81,
    vk_alpha_g1: [
        45, 77, 154, 167, 227, 2, 217, 223, 65, 116, 157, 85, 7, 148, 157, 5, 219, 234, 51, 251,
        177, 108, 100, 59, 34, 245, 153, 162, 190, 109, 242, 226, 20, 190, 221, 80, 60, 55, 206,
        176, 97, 216, 236, 96, 32, 159, 227, 69, 206, 137, 131, 10, 25, 35, 3, 1, 240, 118, 202,
        255, 0, 77, 25, 38,
    ],
    vk_beta_g2: [
        9, 103, 3, 47, 203, 247, 118, 209, 175, 201, 133, 248, 136, 119, 241, 130, 211, 132, 128,
        166, 83, 242, 222, 202, 169, 121, 76, 188, 59, 243, 6, 12, 14, 24, 120, 71, 173, 76, 121,
        131, 116, 208, 214, 115, 43, 245, 1, 132, 125, 214, 139, 192, 224, 113, 36, 30, 2, 19, 188,
        127, 193, 61, 183, 171, 48, 76, 251, 209, 224, 138, 112, 74, 153, 245, 232, 71, 217, 63,
        140, 60, 170, 253, 222, 196, 107, 122, 13, 55, 157, 166, 154, 77, 17, 35, 70, 167, 23, 57,
        193, 177, 164, 87, 168, 199, 49, 49, 35, 210, 77, 47, 145, 146, 248, 150, 183, 198, 62,
        234, 5, 169, 213, 127, 6, 84, 122, 208, 206, 200,
    ],
    vk_gamma_g2: [
        25, 142, 147, 147, 146, 13, 72, 58, 114, 96, 191, 183, 49, 251, 93, 37, 241, 170, 73, 51,
        53, 169, 231, 18, 151, 228, 133, 183, 174, 243, 18, 194, 24, 0, 222, 239, 18, 31, 30, 118,
        66, 106, 0, 102, 94, 92, 68, 121, 103, 67, 34, 212, 247, 94, 218, 221, 70, 222, 189, 92,
        217, 146, 246, 237, 9, 6, 137, 208, 88, 95, 240, 117, 236, 158, 153, 173, 105, 12, 51, 149,
        188, 75, 49, 51, 112, 179, 142, 243, 85, 172, 218, 220, 209, 34, 151, 91, 18, 200, 94, 165,
        219, 140, 109, 235, 74, 171, 113, 128, 141, 203, 64, 143, 227, 209, 231, 105, 12, 67, 211,
        123, 76, 230, 204, 1, 102, 250, 125, 170,
    ],
    vk_delta_g2: [
        3, 176, 60, 213, 239, 250, 149, 172, 155, 238, 148, 241, 245, 239, 144, 113, 87, 189, 164,
        129, 44, 207, 11, 76, 145, 244, 43, 182, 41, 248, 58, 28, 26, 160, 133, 255, 40, 23, 154,
        18, 217, 34, 219, 160, 84, 112, 87, 204, 170, 233, 75, 157, 105, 207, 170, 78, 96, 64, 31,
        234, 127, 62, 3, 51, 17, 12, 16, 19, 79, 32, 11, 25, 246, 73, 8, 70, 213, 24, 201, 174,
        168, 104, 54, 110, 251, 114, 40, 202, 92, 145, 210, 148, 13, 3, 7, 98, 30, 96, 243, 31,
        203, 247, 87, 232, 55, 232, 103, 23, 131, 24, 131, 45, 11, 45, 116, 213, 158, 47, 234, 28,
        113, 66, 223, 24, 125, 63, 198, 211,
    ],
    vk_ic: &[
        [
            18, 172, 154, 37, 220, 213, 225, 168, 50, 169, 6, 26, 8, 44, 21, 221, 29, 97, 170, 156,
            77, 85, 53, 5, 115, 157, 15, 93, 101, 220, 59, 228, 2, 90, 167, 68, 88, 30, 190, 122,
            217, 23, 49, 145, 28, 137, 133, 105, 16, 111, 245, 162, 211, 15, 62, 238, 43, 35, 198,
            14, 233, 128, 172, 212,
        ],
        [
            7, 7, 185, 32, 188, 151, 140, 2, 242, 146, 250, 226, 3, 110, 5, 123, 229, 66, 148, 17,
            76, 204, 60, 135, 105, 216, 131, 246, 136, 161, 66, 63, 46, 50, 160, 148, 183, 88, 149,
            84, 247, 188, 53, 123, 246, 52, 129, 172, 210, 213, 85, 85, 194, 3, 56, 55, 130, 164,
            101, 7, 135, 255, 102, 66,
        ],
        [
            11, 202, 54, 226, 203, 230, 57, 75, 62, 36, 151, 81, 133, 63, 150, 21, 17, 1, 28, 113,
            72, 227, 54, 244, 253, 151, 70, 68, 133, 15, 195, 71, 46, 222, 124, 154, 207, 72, 207,
            58, 55, 41, 250, 61, 104, 113, 78, 42, 132, 53, 212, 250, 109, 184, 247, 244, 9, 193,
            83, 177, 252, 223, 155, 139,
        ],
        [
            27, 138, 249, 153, 219, 251, 179, 146, 124, 9, 28, 194, 170, 242, 1, 228, 136, 203,
            172, 195, 226, 198, 182, 251, 90, 37, 249, 17, 46, 4, 242, 167, 43, 145, 162, 106, 169,
            46, 27, 111, 87, 34, 148, 159, 25, 42, 129, 200, 80, 213, 134, 216, 26, 96, 21, 127,
            62, 156, 240, 79, 103, 156, 204, 214,
        ],
        [
            43, 95, 73, 78, 214, 116, 35, 91, 138, 193, 117, 11, 223, 213, 167, 97, 95, 0, 45, 74,
            29, 206, 254, 221, 208, 110, 218, 90, 7, 108, 205, 13, 47, 229, 32, 173, 32, 32, 170,
            185, 203, 186, 129, 127, 203, 185, 168, 99, 184, 167, 111, 248, 143, 20, 249, 18, 197,
            231, 22, 101, 178, 173, 94, 130,
        ],
        [
            15, 28, 60, 13, 93, 157, 160, 250, 3, 102, 104, 67, 205, 228, 232, 46, 134, 155, 165,
            37, 47, 206, 60, 37, 213, 148, 3, 32, 177, 196, 212, 147, 33, 75, 252, 255, 116, 244,
            37, 246, 254, 140, 13, 7, 179, 7, 72, 45, 139, 200, 187, 47, 54, 8, 246, 130, 135, 170,
            1, 189, 11, 105, 232, 9,
        ],
    ],
};

#[derive(BorshSerialize, BorshDeserialize)]
struct Storage {
    public_inputs: [[u8; 32]; 5],
}

#[derive(Debug)]
enum Instruction {
    VerifyProof,
}

impl Instruction {
    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }
        match input[0] {
            0 => Ok(Instruction::VerifyProof),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = Instruction::unpack(instruction_data)?;

    match instruction {
        Instruction::VerifyProof => verify_proof(accounts, &instruction_data[1..]),
    }
}

fn verify_proof(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.is_empty() {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let public_inputs_account = &accounts[0];

    // [claim_digest (32 bytes) | compressed_proof_a (32 bytes) | compressed_proof_b (64 bytes) | compressed_proof_c (32 bytes)]
    if data.len() != 160 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let claim_digest: [u8; 32] = data[..32]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let public_inputs = public_inputs(
        claim_digest,
        ALLOWED_CONTROL_ROOT,
        BN254_IDENTITY_CONTROL_ID,
    )?;

    let stored_public_inputs = Storage {
        public_inputs: public_inputs.inputs,
    };

    borsh::to_writer(
        &mut public_inputs_account.data.borrow_mut()[..],
        &stored_public_inputs,
    )?;

    msg!("Generated and stored public inputs.");

    // Extract and decompress proof components
    let compressed_proof_a: &[u8; 32] = data[32..64]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let compressed_proof_b: &[u8; 64] = data[64..128]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let compressed_proof_c: &[u8; 32] = data[128..160]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let proof_a = decompress_g1(compressed_proof_a).map_err(|_| ProgramError::Custom(1))?;
    let proof_b = decompress_g2(compressed_proof_b).map_err(|_| ProgramError::Custom(2))?;
    let proof_c = decompress_g1(compressed_proof_c).map_err(|_| ProgramError::Custom(3))?;

    let proof = Proof {
        pi_a: proof_a,
        pi_b: proof_b,
        pi_c: proof_c,
    };

    // Verify the proof
    let verifier = Verifier::new(&proof, &public_inputs, &VERIFYING_KEY);

    verifier.verify().map_err(|e| {
        msg!("Proof verification failed: {:?}", e);
        ProgramError::Custom(4)
    })?;

    msg!("Proof successfully verified.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use risc0_solana::non_solana::{self, negate_g1};
    use risc0_zkvm::sha::Digestible;
    use risc0_zkvm::Receipt;
    use solana_program::clock::Epoch;
    use solana_program::pubkey::Pubkey;
    use solana_program::rent::Rent;

    fn get_receipt_data() -> ([u8; 32], Proof) {
        let receipt_json_str = include_bytes!("../../../../test/data/receipt.json");
        let receipt: Receipt = serde_json::from_slice(receipt_json_str).unwrap();
        let claim_digest = receipt
            .inner
            .groth16()
            .unwrap()
            .claim
            .digest()
            .try_into()
            .unwrap();

        let proof_raw = &receipt.inner.groth16().unwrap().seal;
        let mut proof: Proof = Proof {
            pi_a: proof_raw[0..64].try_into().unwrap(),
            pi_b: proof_raw[64..192].try_into().unwrap(),
            pi_c: proof_raw[192..256].try_into().unwrap(),
        };
        proof.pi_a = negate_g1(&proof.pi_a).unwrap();

        (claim_digest, proof)
    }

    #[test]
    fn test_verify() {
        let (claim_digest, proof) = get_receipt_data();
        // Create a mock program ID
        let program_id = Pubkey::new_unique();

        // Create a mock account for storing the public inputs
        let pubinput_key = Pubkey::new_unique();
        let mut pubinput_lamports = Rent::default().minimum_balance(160); // 5 * 32 bytes
        let mut pubinput_data = vec![0u8; 160];
        let pubinput_account = AccountInfo::new(
            &pubinput_key,
            true,
            true,
            &mut pubinput_lamports,
            &mut pubinput_data,
            &program_id,
            false,
            Epoch::default(),
        );

        let compressed_proof_a = non_solana::compress_g1_be(&proof.pi_a);
        let compressed_proof_b = non_solana::compress_g2_be(&proof.pi_b);
        let compressed_proof_c = non_solana::compress_g1_be(&proof.pi_c);

        // Prepare the instruction data for generate and verify
        let instruction_data = [
            &[0],
            &claim_digest[..],
            &compressed_proof_a,
            &compressed_proof_b,
            &compressed_proof_c,
        ]
        .concat();

        let accounts = vec![pubinput_account.clone()];
        let result = process_instruction(&program_id, &accounts, &instruction_data);

        assert!(
            result.is_ok(),
            "Failed to process GenAndVerify instruction: {:?}",
            result
        );
    }

    #[test]
    fn fail_verify_with_invalid_proof() {
        let (claim_digest, proof) = get_receipt_data();

        let program_id = Pubkey::new_unique();

        let pubinput_key = Pubkey::new_unique();
        let mut pubinput_lamports = Rent::default().minimum_balance(160);
        let mut pubinput_data = vec![0u8; 160];
        let pubinput_account = AccountInfo::new(
            &pubinput_key,
            true,
            true,
            &mut pubinput_lamports,
            &mut pubinput_data,
            &program_id,
            false,
            Epoch::default(),
        );

        let compressed_proof_a = non_solana::compress_g1_be(&proof.pi_a);
        let compressed_proof_b = non_solana::compress_g2_be(&proof.pi_b);
        let mut invalid_proof_c = non_solana::compress_g1_be(&proof.pi_c);

        // Modify the proof to make it invalid
        invalid_proof_c[0] ^= 0xFF;

        let instruction_data = [
            &[0],
            &claim_digest[..],
            &compressed_proof_a,
            &compressed_proof_b,
            &invalid_proof_c,
        ]
        .concat();

        let accounts = vec![pubinput_account.clone()];
        let result = process_instruction(&program_id, &accounts, &instruction_data);

        assert!(result.is_err(), "Expected an error due to invalid proof");
        assert_eq!(
            result.unwrap_err(),
            ProgramError::Custom(4),
            "Expected Custom(4) error for proof verification failure"
        );
    }

    #[test]
    fn fail_test_verify_with_invalid_instruction_data() {
        let program_id = Pubkey::new_unique();
        let pubinput_key = Pubkey::new_unique();
        let mut pubinput_lamports = Rent::default().minimum_balance(160);
        let mut pubinput_data = vec![0u8; 160];
        let pubinput_account = AccountInfo::new(
            &pubinput_key,
            true,
            true,
            &mut pubinput_lamports,
            &mut pubinput_data,
            &program_id,
            false,
            Epoch::default(),
        );

        // Prepare invalid instruction data (too short)
        let invalid_instruction_data = vec![0; 100]; // Should be 161 bytes (1 + 32 + 32 + 64 + 32)

        let accounts = vec![pubinput_account.clone()];
        let result = process_instruction(&program_id, &accounts, &invalid_instruction_data);

        assert!(
            result.is_err(),
            "Expected an error due to invalid instruction data"
        );
        assert_eq!(
            result.unwrap_err(),
            ProgramError::InvalidInstructionData,
            "Expected InvalidInstructionData error"
        );
    }
}
