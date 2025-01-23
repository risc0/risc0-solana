use anchor_lang::prelude::*;
use anchor_lang::solana_program::alt_bn128::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::system_program;
use error::VerifierError;
use hex_literal::hex;

mod error;
mod vk;

#[cfg(any(feature = "client", test))]
mod client;

pub use vk::{VerificationKey, VERIFICATION_KEY};

declare_id!("EsJUxZK9qexcHRXr1dVoxt2mUhVAyaoRWBaaRxH5zQJD");

// Base field modulus 'q' for BN254
// https://docs.rs/ark-bn254/latest/ark_bn254/
pub const BASE_FIELD_MODULUS_Q: [u8; 32] =
    hex!("30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD47");
// REF: https://github.com/risc0/risc0/blob/main/risc0/circuit/recursion/src/control_id.rs#L47
pub const ALLOWED_CONTROL_ROOT: [u8; 32] =
    hex!("8cdad9242664be3112aba377c5425a4df735eb1c6966472b561d2855932c0469");
// REF: https://github.com/risc0/risc0/blob/main/risc0/circuit/recursion/src/control_id.rs#L51
pub const BN254_IDENTITY_CONTROL_ID: [u8; 32] =
    hex!("c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404");
// SHA256('risc0.Output')
pub const OUTPUT_TAG: [u8; 32] =
    hex!("77eafeb366a78b47747de0d7bb176284085ff5564887009a5be63da32d3559d4");
// SHA256('risc0.SystemState')
pub const SYSTEM_STATE_TAG: [u8; 32] =
    hex!("206115a847207c0892e0c0547225df31d02a96eeb395670c31112dff90b421d6");
// SHA256('risc0.ReceiptClaim')
pub const RECEIPT_CLAIM_TAG: [u8; 32] =
    hex!("cb1fefcd1f2d9a64975cbbbf6e161e2914434b0cbb9960b84df5d717e86b48af");
// SHA256('risc0.SystemState(pc=0, merkle_root=0)')
pub const SYSTEM_STATE_ZERO_DIGEST: [u8; 32] =
    hex!("a3acc27117418996340b84e5a90f3ef4c49d22c79e44aad822ec9c313e1eb8e2");

/// Groth16 proof elements on BN254 curve
/// - pi_a must be a point in G1
/// - pi_b must be a point in G2
/// - pi_c must be a point in G1
///   Note: pi_a must be negated before calling verify
#[derive(Clone, PartialEq, Eq, AnchorDeserialize, AnchorSerialize)]
pub struct Proof {
    // NOTE: `pi_a` is expected to be the **negated**
    pub pi_a: [u8; 64],
    pub pi_b: [u8; 128],
    pub pi_c: [u8; 64],
}

/// N public inputs for Groth16 proof verification
#[derive(Clone, PartialEq, Eq, AnchorDeserialize, AnchorSerialize)]
pub struct PublicInputs<const N: usize> {
    pub inputs: [[u8; 32]; N],
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[program]
pub mod groth_16_verifier {
    use super::*;

    /// Verifies a RISC Zero zkVM Groth16 receipt
    pub fn verify(
        _ctx: Context<VerifyProof>,
        proof: Proof,
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        let claim_digest = hash_claim(&image_id, &journal_digest);
        let public_inputs = public_inputs(claim_digest)?;
        verify_groth16(&proof, &public_inputs)
    }
}

/// Generate a receipt claim digest
pub fn hash_claim(image_id: &[u8; 32], journal_digest: &[u8; 32]) -> [u8; 32] {
    let input_digest = [0u8; 32];
    let pre_digest = image_id;
    let post_digest = SYSTEM_STATE_ZERO_DIGEST;
    let output_digest = hash_output(journal_digest, &[0u8; 32]);
    let system_exit = 0;
    let user_exit = 0;

    hash_receipt_claim(
        &input_digest,
        pre_digest,
        &post_digest,
        &output_digest,
        system_exit,
        user_exit,
    )
}

/// Negate a BN254 G1 curve point
pub fn negate_g1(point: &[u8; 64]) -> [u8; 64] {
    let mut negated_point = [0u8; 64];
    negated_point[..32].copy_from_slice(&point[..32]);

    let mut y = [0u8; 32];
    y.copy_from_slice(&point[32..]);

    let mut modulus = BASE_FIELD_MODULUS_Q;
    subtract_be_bytes(&mut modulus, &y);
    negated_point[32..].copy_from_slice(&modulus);

    negated_point
}

/// Verifies a Groth16 proof
/// Note: The proof's `pi_a` element is expected to be negated.
fn verify_groth16<const N_PUBLIC: usize>(
    proof: &Proof,
    public: &PublicInputs<N_PUBLIC>,
) -> Result<()> {
    let vk = VERIFICATION_KEY;

    if vk.vk_ic.len() != N_PUBLIC + 1 {
        return err!(VerifierError::InvalidPublicInput);
    }

    let mut prepared = vk.vk_ic[0];
    for (i, input) in public.inputs.iter().enumerate() {
        let reduced = reduce_scalar_mod_q(*input);
        let mul_res = alt_bn128_multiplication(&[&vk.vk_ic[i + 1][..], &reduced[..]].concat())
            .map_err(|_| error!(VerifierError::ArithmeticError))?;
        prepared = alt_bn128_addition(&[&mul_res[..], &prepared[..]].concat())
            .map_err(|_| error!(VerifierError::ArithmeticError))?
            .try_into()
            .map_err(|_| error!(VerifierError::ArithmeticError))?;
    }

    let pairing_input = [
        proof.pi_a.as_slice(),
        proof.pi_b.as_slice(),
        prepared.as_slice(),
        vk.vk_gamma_g2.as_slice(),
        proof.pi_c.as_slice(),
        vk.vk_delta_g2.as_slice(),
        vk.vk_alpha_g1.as_slice(),
        vk.vk_beta_g2.as_slice(),
    ]
    .concat();

    //  Use the Solana alt_bn128_pairing syscall.
    //
    //  The `alt_bn128_pairing` function does not return the actual pairing result.
    //  Instead, it returns a 32-byte big-endian integer:
    //   - If the pairing check passes, it returns 1 represented as a 32-byte big-endian integer (`[0u8; 31] + [1u8]`).
    //   - If the pairing check fails, it returns 0 represented as a 32-byte big-endian integer (`[0u8; 32]`).
    let pairing_res = alt_bn128_pairing(&pairing_input).map_err(|_| VerifierError::PairingError)?;
    let mut expected = [0u8; 32];
    expected[31] = 1;

    if pairing_res != expected {
        return err!(VerifierError::VerificationError);
    }

    Ok(())
}

/// Generate Output digest
/// SHA256('risc0.Output' || journal_digest || assumptions_digest || 0x0200)
fn hash_output(journal_digest: &[u8; 32], assumptions_digest: &[u8; 32]) -> [u8; 32] {
    let down_len = (2u16 << 8).to_be_bytes();
    hashv(&[&OUTPUT_TAG, journal_digest, assumptions_digest, &down_len]).to_bytes()
}

/// Generate ReceiptClaim digest
/// SHA256('risc0.ReceiptClaim' || input || preState || postState || output || system_code || user_code || 0x0400)
fn hash_receipt_claim(
    input_digest: &[u8; 32],
    pre_state_digest: &[u8; 32],
    post_state_digest: &[u8; 32],
    output_digest: &[u8; 32],
    system_exit_code: u32,
    user_exit_code: u32,
) -> [u8; 32] {
    let system_bytes = (system_exit_code << 24).to_be_bytes();
    let user_bytes = (user_exit_code << 24).to_be_bytes();
    let down_len = (4u16 << 8).to_be_bytes();

    hashv(&[
        &RECEIPT_CLAIM_TAG,
        input_digest,
        pre_state_digest,
        post_state_digest,
        output_digest,
        &system_bytes,
        &user_bytes,
        &down_len,
    ])
    .to_bytes()
}

/// Process claim digest into Groth16 public inputs
/// Generates five field elements:
/// - (a0,a1): Allowed control root split into two field elements
/// - (c0,c1): Claim digest split into two field elements
/// - id: BN254 identity control ID
fn public_inputs(claim_digest: [u8; 32]) -> Result<PublicInputs<5>> {
    if claim_digest == [0u8; 32] {
        return err!(VerifierError::InvalidPublicInput);
    }

    let (a0, a1) = split_digest(ALLOWED_CONTROL_ROOT)?;
    let (c0, c1) = split_digest(claim_digest)?;

    let mut id = BN254_IDENTITY_CONTROL_ID.to_vec();
    id.reverse();

    Ok(PublicInputs {
        inputs: [a0, a1, c0, c1, to_field_element(&id)],
    })
}

/// Split Digest into two 32-byte field elements
fn split_digest(bytes: [u8; 32]) -> Result<([u8; 32], [u8; 32])> {
    let big_endian: Vec<u8> = bytes.iter().rev().copied().collect();
    let (b, a) = big_endian.split_at(big_endian.len() / 2);
    Ok((to_field_element(a), to_field_element(b)))
}

/// Convert arbitrary bytes to 32-byte field element
fn to_field_element(input: &[u8]) -> [u8; 32] {
    let mut fixed_array = [0u8; 32];
    let start_index = 32 - input.len();
    fixed_array[start_index..].copy_from_slice(input);
    fixed_array
}

/// Subtract big-endian numbers
fn subtract_be_bytes(a: &mut [u8; 32], b: &[u8; 32]) {
    let mut borrow: u32 = 0;
    for (ai, bi) in a.iter_mut().zip(b.iter()).rev() {
        let result = (*ai as u32).wrapping_sub(*bi as u32).wrapping_sub(borrow);
        *ai = result as u8;
        borrow = (result >> 31) & 1;
    }
}

/// Reduce field element modulo BN254 base field
fn reduce_scalar_mod_q(mut x: [u8; 32]) -> [u8; 32] {
    while x.iter().cmp(BASE_FIELD_MODULUS_Q.iter()) != std::cmp::Ordering::Less {
        subtract_be_bytes(&mut x, &BASE_FIELD_MODULUS_Q);
    }
    x
}

#[cfg(test)]
mod test_groth16_lib {
    use super::client::*;
    use super::*;
    use risc0_zkvm::sha::Digestible;
    use risc0_zkvm::Receipt;
    use std::cmp::Ordering;

    // Reference base field modulus for BN254
    // https://docs.rs/ark-bn254/latest/ark_bn254/
    const REF_BASE_FIELD_MODULUS: &str =
        "21888242871839275222246405745257275088696311157297823662689037894645226208583";

    fn load_receipt_and_extract_data() -> (Receipt, Proof, PublicInputs<5>) {
        let receipt_json_str = include_bytes!("../test/data/receipt.json");
        let receipt: Receipt = serde_json::from_slice(receipt_json_str).unwrap();

        let claim_digest = receipt
            .inner
            .groth16()
            .unwrap()
            .claim
            .digest()
            .try_into()
            .unwrap();
        let public_inputs = public_inputs(claim_digest).unwrap();

        let proof_raw = &receipt.inner.groth16().unwrap().seal;
        let mut proof = Proof {
            pi_a: proof_raw[0..64].try_into().unwrap(),
            pi_b: proof_raw[64..192].try_into().unwrap(),
            pi_c: proof_raw[192..256].try_into().unwrap(),
        };
        proof.pi_a = negate_g1(&proof.pi_a);

        (receipt, proof, public_inputs)
    }

    #[test]
    fn test_convert_g1_invalid_z() {
        let values = vec![
            "1".to_string(), // x
            "2".to_string(), // y
            "0".to_string(), // z (invalid)
        ];

        let result = convert_g1(&values);

        assert!(
            result.is_err(),
            "Expected error due to invalid Z coordinate"
        );
        assert_eq!(
            result.unwrap_err().to_string(),
            "Invalid G1 point: Z coordinate is not 1 (found 0)"
        );
    }

    #[test]
    fn test_convert_g2_invalid_z() {
        let values = vec![
            vec!["1".to_string(), "2".to_string()], // x
            vec!["3".to_string(), "4".to_string()], // y
            vec!["0".to_string(), "0".to_string()], // z (invalid)
        ];

        let result = convert_g2(&values);

        assert!(
            result.is_err(),
            "Expected error due to invalid Z coordinate"
        );
        assert_eq!(
            result.unwrap_err().to_string(),
            "Invalid G2 point: Z coordinate is not [1, 0] (found [0, 0])"
        );
    }

    #[test]
    fn test_proof() {
        let (_, proof, _) = load_receipt_and_extract_data();
        // Convert to bytes
        let proof_bytes = proof.to_bytes();
        // Check that we have 256 bytes
        assert_eq!(proof_bytes.len(), 256);
    }

    #[test]
    pub fn test_verify() {
        let (_, proof, public_inputs) = load_receipt_and_extract_data();
        let res = verify_groth16(&proof, &public_inputs);
        assert!(res.is_ok(), "Verification failed");
    }

    #[test]
    fn test_base_field_modulus_against_reference() {
        use num_bigint::BigUint;

        let ref_base_field_modulus = BigUint::parse_bytes(REF_BASE_FIELD_MODULUS.as_bytes(), 10)
            .expect("Failed to parse BASE_FIELD_MODULUS");

        let ref_base_field_modulus_hex = format!("{:X}", ref_base_field_modulus);

        let field_modulus_q_hex: String = BASE_FIELD_MODULUS_Q
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect();

        assert_eq!(
            field_modulus_q_hex, ref_base_field_modulus_hex,
            "FIELD_MODULUS_Q does not match reference REF_BASE_FIELD_MODULUS"
        );
    }

    #[test]
    fn test_claim_digest() {
        let (receipt, _, _) = load_receipt_and_extract_data();
        let actual_claim_digest = receipt.claim().unwrap().digest();

        // image id of receipt.json
        const IMG_ID: [u32; 8] = [
            18688597, 1673543865, 1491143371, 721664238, 865920440, 525156886, 2498763974,
            799689043,
        ];

        let mut image_id = [0u8; 32];
        for (i, &val) in IMG_ID.iter().enumerate() {
            let bytes = val.to_le_bytes();
            image_id[i * 4..(i + 1) * 4].copy_from_slice(&bytes);
        }
        let calculated_claim_digest: [u8; 32] = hash_claim(
            &image_id,
            <&[u8; 32]>::try_from(receipt.journal.digest().as_bytes()).unwrap(),
        );
        assert_eq!(
            actual_claim_digest.as_bytes(),
            calculated_claim_digest,
            "Claim digests do not match"
        );
    }

    #[test]
    fn test_verify_invalid_proof() {
        let (_, mut proof, public_inputs) = load_receipt_and_extract_data();
        // Corrupt proof
        proof.pi_a[0] ^= 1;
        let res = verify_groth16(&proof, &public_inputs);
        assert!(res.is_err());
    }

    #[test]
    fn test_verify_invalid_public_inputs() {
        let (_, proof, mut public_inputs) = load_receipt_and_extract_data();
        // Corrupt input
        public_inputs.inputs[0][0] ^= 1;
        let res = verify_groth16(&proof, &public_inputs);
        assert!(res.is_err());
    }

    #[test]
    fn test_public_inputs_validation() {
        // Test zero claim digest (this should be rejected)
        let result = public_inputs([0u8; 32]);
        assert!(result.is_err(), "Should reject zero input");

        // Test large scalar (this should be allowed and reduced)
        let mut large_scalar = BASE_FIELD_MODULUS_Q;
        large_scalar[31] += 1;
        let result = public_inputs(large_scalar);
        assert!(result.is_ok(), "Should accept and reduce large scalar");
    }

    #[test]
    fn test_digest_computation() {
        let image_id = [1u8; 32];
        let journal_digest = [2u8; 32];
        let digest = hash_claim(&image_id, &journal_digest);
        assert_ne!(digest, [0u8; 32], "Should generate non-zero digest" );
    }

    #[test]
    fn test_scalar_reduction_mod_q() {
        let mut input = BASE_FIELD_MODULUS_Q;
        input[0] = 0xFF;
        let reduced = reduce_scalar_mod_q(input);
        assert_eq!(
            reduced.iter().cmp(BASE_FIELD_MODULUS_Q.iter()),
            Ordering::Less
        );

        let large_input = [0xFF; 32];
        let reduced = reduce_scalar_mod_q(large_input);
        assert_eq!(
            reduced.iter().cmp(BASE_FIELD_MODULUS_Q.iter()),
            Ordering::Less
        );

        let reduced = reduce_scalar_mod_q(BASE_FIELD_MODULUS_Q);
        assert_eq!(reduced, [0u8; 32], "q mod q should be zero");
    }
}
