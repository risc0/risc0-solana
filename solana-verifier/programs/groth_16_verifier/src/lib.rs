use anchor_lang::prelude::*;
use anchor_lang::solana_program::alt_bn128::prelude::{
    alt_bn128_addition, alt_bn128_multiplication, alt_bn128_pairing,
};
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::system_program;
use error::VerifierError;
use hex_literal::hex;
use risc0_zkp::core::digest::Digest;

mod error;
mod vk;

#[cfg(any(feature = "client", test))]
mod client;

pub use vk::{VerificationKey, VERIFICATION_KEY};

declare_id!("EsJUxZK9qexcHRXr1dVoxt2mUhVAyaoRWBaaRxH5zQJD");

// Base field modulus `q` for BN254
// https://docs.rs/ark-bn254/latest/ark_bn254/
pub const BASE_FIELD_MODULUS_Q: [u8; 32] =
    hex!("30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD47");
// From: https://github.com/risc0/risc0/blob/v1.1.1/risc0/circuit/recursion/src/control_id.rs#L47
pub const ALLOWED_CONTROL_ROOT: [u8; 32] =
    hex!("8cdad9242664be3112aba377c5425a4df735eb1c6966472b561d2855932c0469");
// From: https://github.com/risc0/risc0/blob/v1.1.1/risc0/circuit/recursion/src/control_id.rs#L51
pub const BN254_IDENTITY_CONTROL_ID: [u8; 32] =
    hex!("c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404");
// SHA256 TAG_DIGEST of 'risc0.Output'
pub const OUTPUT_TAG: [u8; 32] =
    hex!("77eafeb366a78b47747de0d7bb176284085ff5564887009a5be63da32d3559d4");
// SHA256 TAG_DIGEST of 'risc0.SystemState'
pub const SYSTEM_STATE_TAG: [u8; 32] =
    hex!("206115a847207c0892e0c0547225df31d02a96eeb395670c31112dff90b421d6");
// SHA256 TAG_DIGEST of 'risc0.ReceiptClaim'
pub const RECEIPT_CLAIM_TAG: [u8; 32] =
    hex!("cb1fefcd1f2d9a64975cbbbf6e161e2914434b0cbb9960b84df5d717e86b48af");
// SHA256 TAG_DIGEST of 'risc0.SystemState(pc=0, merkle_root=0)'
pub const SYSTEM_STATE_ZERO_DIGEST: [u8; 32] =
    hex!("a3acc27117418996340b84e5a90f3ef4c49d22c79e44aad822ec9c313e1eb8e2");

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[program]
pub mod groth_16_verifier {
    use super::*;

    pub fn verify(
        _ctx: Context<VerifyProof>,
        proof: Proof,
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        verify_proof(&proof, &image_id, &journal_digest)
    }
}

pub fn verify_proof(proof: &Proof, image_id: &[u8; 32], journal_digest: &[u8; 32]) -> Result<()> {
    let claim_digest = compute_claim_digest(image_id, journal_digest);

    let public_inputs = public_inputs(claim_digest)?;

    verify_groth16(proof, &public_inputs)
}

pub fn compute_journal_digest(journal: &[u8]) -> [u8; 32] {
    hashv(&[journal]).to_bytes()
}

/// Compute the digest of an `Output` struct:
/// ```solidity
/// bytes32 constant TAG_DIGEST = sha256("risc0.Output");
/// function digest(Output o) returns (bytes32) {
///   return sha256(abi.encodePacked(
///       TAG_DIGEST,
///       o.journalDigest,
///       o.assumptionsDigest,
///       (uint16(2) << 8)
///   ));
/// }
/// ```
/// The final 2 bytes are `0x0200`.
fn compute_output_digest(journal_digest: &[u8; 32], assumptions_digest: &[u8; 32]) -> [u8; 32] {
    let down_len = (2u16 << 8).to_be_bytes();
    hashv(&[&OUTPUT_TAG, journal_digest, assumptions_digest, &down_len]).to_bytes()
}

fn compute_output_digest_ok(journal_digest: &[u8; 32]) -> [u8; 32] {
    compute_output_digest(journal_digest, &[0u8; 32])
}

/// Compute the digest of a `ReceiptClaim
/// ```solidity
/// bytes32 constant TAG_DIGEST = sha256("risc0.ReceiptClaim");
/// function digest(ReceiptClaim claim) returns (bytes32) {
///   return sha256(abi.encodePacked(
///       TAG_DIGEST,
///       claim.input,               // 32 bytes
///       claim.preStateDigest,      // 32 bytes
///       claim.postStateDigest,     // 32 bytes
///       claim.output,              // 32 bytes
///       (uint32(claim.exitCode.system) << 24),  // 4 bytes
///       (uint32(claim.exitCode.user) << 24),    // 4 bytes
///       (uint16(4) << 8)          // 0x0400, 2 bytes
///   ));
/// }
/// ```
fn compute_receipt_claim_digest(
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

pub fn compute_claim_digest(image_id: &[u8; 32], journal_digest: &[u8; 32]) -> [u8; 32] {
    let input_digest = [0u8; 32];
    let pre_digest = image_id;
    let post_digest = SYSTEM_STATE_ZERO_DIGEST;
    let output_digest = compute_output_digest_ok(journal_digest);
    let system_exit = 0;
    let user_exit = 0;

    compute_receipt_claim_digest(
        &input_digest,
        pre_digest,
        &post_digest,
        &output_digest,
        system_exit,
        user_exit,
    )
}

#[derive(Debug, Clone, PartialEq, Eq, AnchorDeserialize, AnchorSerialize)]
pub struct Proof {
    // NOTE: `pi_a` is expected to be the **negated**
    pub pi_a: [u8; 64],
    pub pi_b: [u8; 128],
    pub pi_c: [u8; 64],
}

#[derive(Debug, Clone, PartialEq, Eq, AnchorDeserialize, AnchorSerialize)]
pub struct PublicInputs<const N: usize> {
    pub inputs: [[u8; 32]; N],
}

/// Verifies a Groth16 proof.
///
/// # Arguments
///
/// * `proof` - The proof to verify.
/// * `public` - The public inputs to the proof.
/// * `vk` - The verification key.
///
/// Note: The proof's `pi_a` element is expected to be the negated version of the proof element.
/// Ensure that `pi_a` has been negated before calling this function.
///
/// # Returns
///
/// * `Ok(())` if the proof is valid.
/// * `Err(ProgramError)` if the proof is invalid or an error occurs.
pub fn verify_groth16<const N_PUBLIC: usize>(
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

pub fn public_inputs(claim_digest: [u8; 32]) -> Result<PublicInputs<5>> {
    if claim_digest == [0u8; 32] {
        return err!(VerifierError::InvalidPublicInput);
    }

    let allowed_control_root: Digest = Digest::from_bytes(ALLOWED_CONTROL_ROOT);
    let bn254_identity_control_id: Digest = Digest::from_bytes(BN254_IDENTITY_CONTROL_ID);

    let (a0, a1) = split_digest_bytes(allowed_control_root)?;
    let (c0, c1) = split_digest_bytes(Digest::from(claim_digest))?;

    let mut id_bn554 = bn254_identity_control_id.as_bytes().to_vec();
    id_bn554.reverse();
    let id_bn254_fr = to_fixed_array(&id_bn554);

    Ok(PublicInputs {
        inputs: [a0, a1, c0, c1, id_bn254_fr],
    })
}

fn split_digest_bytes(d: Digest) -> Result<([u8; 32], [u8; 32])> {
    let big_endian: Vec<u8> = d.as_bytes().iter().rev().copied().collect();
    let len = big_endian.len();
    let middle = len / 2;
    let (b, a) = big_endian.split_at(middle);
    Ok((to_fixed_array(a), to_fixed_array(b)))
}

fn to_fixed_array(input: &[u8]) -> [u8; 32] {
    let mut fixed_array = [0u8; 32];
    let start_index = 32 - input.len();
    fixed_array[start_index..].copy_from_slice(input);
    fixed_array
}

fn cmp_256_be(a: &[u8; 32], b: &[u8; 32]) -> std::cmp::Ordering {
    a.iter().cmp(b.iter())
}

fn sub_256_be(a: &mut [u8; 32], b: &[u8; 32]) {
    let mut borrow: u32 = 0;
    for (ai, bi) in a.iter_mut().zip(b.iter()).rev() {
        let result = (*ai as u32).wrapping_sub(*bi as u32).wrapping_sub(borrow);
        *ai = result as u8;
        borrow = (result >> 31) & 1;
    }
}

fn reduce_scalar_mod_q(mut x: [u8; 32]) -> [u8; 32] {
    while cmp_256_be(&x, &BASE_FIELD_MODULUS_Q) != std::cmp::Ordering::Less {
        sub_256_be(&mut x, &BASE_FIELD_MODULUS_Q);
    }
    x
}

pub fn negate_g1(point: &[u8; 64]) -> [u8; 64] {
    let mut negated_point = [0u8; 64];
    negated_point[..32].copy_from_slice(&point[..32]);

    let mut y = [0u8; 32];
    y.copy_from_slice(&point[32..]);

    let mut modulus = BASE_FIELD_MODULUS_Q;
    sub_256_be(&mut modulus, &y);
    negated_point[32..].copy_from_slice(&modulus);

    negated_point
}

#[cfg(test)]
mod test_lib {
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
        println!("{:?}", proof);

        // Convert to bytes
        let proof_bytes = proof.to_bytes();

        println!("PROOF: {:?}", proof_bytes);

        // Check that we have 256 bytes
        assert_eq!(proof_bytes.len(), 256);

        // Test roundtrip
        let exported_json = serde_json::to_string(&proof).unwrap();
        let reimported_proof: Proof = serde_json::from_str(&exported_json).unwrap();
        assert_eq!(proof, reimported_proof, "Proof roundtrip failed");

        println!("Proof bytes: {:?}", proof_bytes);
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
        let calculated_claim_digest: [u8; 32] = compute_claim_digest(
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
        let digest = compute_claim_digest(&image_id, &journal_digest);
        assert_ne!(digest, [0u8; 32]); // Should generate non-zero digest
    }

    #[test]
    fn test_scalar_reduction_mod_q() {
        let mut input = BASE_FIELD_MODULUS_Q;
        input[0] = 0xFF;
        let reduced = reduce_scalar_mod_q(input);
        assert_eq!(cmp_256_be(&reduced, &BASE_FIELD_MODULUS_Q), Ordering::Less);

        let large_input = [0xFF; 32];
        let reduced = reduce_scalar_mod_q(large_input);
        assert_eq!(cmp_256_be(&reduced, &BASE_FIELD_MODULUS_Q), Ordering::Less);

        let reduced = reduce_scalar_mod_q(BASE_FIELD_MODULUS_Q);
        assert_eq!(reduced, [0u8; 32], "q mod q should be zero");
    }
}
