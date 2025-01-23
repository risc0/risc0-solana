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

pub use vk::{VerificationKey, VERIFICATION_KEY};

declare_id!("EsJUxZK9qexcHRXr1dVoxt2mUhVAyaoRWBaaRxH5zQJD");

// Base field modulus `q` for BN254
// https://docs.rs/ark-bn254/latest/ark_bn254/
pub(crate) const BASE_FIELD_MODULUS_Q: [u8; 32] = [
    0x30, 0x64, 0x4E, 0x72, 0xE1, 0x31, 0xA0, 0x29, 0xB8, 0x50, 0x45, 0xB6, 0x81, 0x81, 0x58, 0x5D,
    0x97, 0x81, 0x6A, 0x91, 0x68, 0x71, 0xCA, 0x8D, 0x3C, 0x20, 0x8C, 0x16, 0xD8, 0x7C, 0xFD, 0x47,
];

// From: https://github.com/risc0/risc0/blob/v1.1.1/risc0/circuit/recursion/src/control_id.rs#L47
pub const ALLOWED_CONTROL_ROOT: [u8; 32] =
    hex!("8cdad9242664be3112aba377c5425a4df735eb1c6966472b561d2855932c0469");
// From: https://github.com/risc0/risc0/blob/v1.1.1/risc0/circuit/recursion/src/control_id.rs#L51
pub const BN254_IDENTITY_CONTROL_ID: [u8; 32] =
    hex!("c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404");
// SHA256 TAG_DIGEST of 'risc0.Output'
pub const OUTPUT_TAG: [u8; 32] =
    hex!("77eafeb366a78b47747de0d7bb176284085ff5564887009a5be63da32d3559d4");
// SHA256 TAG_DIGEST of 'risc0.SystemState(pc=0, merkle_root=0)'
pub const SYSTEM_STATE_ZERO_DIGEST: [u8; 32] =
    hex!("a3acc27117418996340b84e5a90f3ef4c49d22c79e44aad822ec9c313e1eb8e2");
// SHA256 TAG_DIGEST of 'risc0.SystemState'
pub const SYSTEM_STATE_TAG: [u8; 32] =
    hex!("206115a847207c0892e0c0547225df31d02a96eeb395670c31112dff90b421d6");
// SHA256 TAG_DIGEST of 'risc0.ReceiptClaim'
pub const RECEIPT_CLAIM_TAG: [u8; 32] =
    hex!("cb1fefcd1f2d9a64975cbbbf6e161e2914434b0cbb9960b84df5d717e86b48af");

#[derive(Accounts)]
// Can't be empty when CPI is enabled see anchor #1628
pub struct VerifyProof<'info> {
    /// CHECK: Only included to satisfy Anchor CPI requirements
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[program]
pub mod groth_16_verifier {
    use super::*;

    pub fn verify(
        _ctx: Context<VerifyProof>,
        proof: Proof,
        // TODO: Anchor really seems to struggle with constant generics in program fields
        // Take a look at this after testing because running behind
        image_id: [u8; 32],
        journal_digest: [u8; 32],
    ) -> Result<()> {
        verify_proof(&proof, &image_id, &journal_digest)
    }
}

pub fn verify_proof(proof: &Proof, image_id: &[u8; 32], journal_digest: &[u8; 32]) -> Result<()> {
    let claim_digest = compute_claim_digest(image_id, journal_digest);

    let public_inputs = public_inputs(claim_digest)?;

    verify_groth_proof(proof, &public_inputs)
}

pub fn compute_journal_digest(journal: &[u8]) -> [u8; 32] {
    let journal_digest = hashv(&[journal]);
    journal_digest.to_bytes()
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
    let down_len = (2u16 << 8).to_be_bytes(); // Inline 0x0200 as big-endian bytes

    let hash_out = hashv(&[&OUTPUT_TAG, journal_digest, assumptions_digest, &down_len]);
    hash_out.to_bytes()
}

/// For the "ok" enum we have `(journalDigest, 0)`.
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

    let hash_out = hashv(&[
        &RECEIPT_CLAIM_TAG,
        input_digest,
        pre_state_digest,
        post_state_digest,
        output_digest,
        &system_bytes,
        &user_bytes,
        &down_len,
    ]);
    hash_out.to_bytes()
}

/// Compute the claim digest from the image_id and journal_digest by creating a Receipt Claim digest
pub fn compute_claim_digest(image_id: &[u8; 32], journal_digest: &[u8; 32]) -> [u8; 32] {
    // 1) input = 0
    let input_digest = [0u8; 32];

    // 2) pre = image_id
    let pre_digest = image_id;

    // 3) post = zero system state
    let post_digest = SYSTEM_STATE_ZERO_DIGEST;

    // 4) output = hash of `Output(journal_digest, 0)`
    let output_digest = compute_output_digest_ok(journal_digest);

    // 5) exitCode = (system=0 => Halted, user=0)
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
    // version of the proof element.
    //
    // The pairing equation for Groth16 verification is:
    //
    // e(-pi_a, vk_beta_g2) * e(vk_alpha_g1, pi_b) * e(prepared_input, vk_gamma_g2) * e(pi_c, vk_delta_g2) == 1
    pub pi_a: [u8; 64],
    pub pi_b: [u8; 128],
    pub pi_c: [u8; 64],
}

// TODO: Was converted into Vec because of time constrain, Anchor really not
// liking generic constants
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
pub fn verify_groth_proof<const N_PUBLIC: usize>(
    proof: &Proof,
    public: &PublicInputs<N_PUBLIC>,
) -> Result<()> {
    let vk = VERIFICATION_KEY;
    // Check vk_ic is the correct length
    if vk.vk_ic.len() != N_PUBLIC + 1 {
        return err!(VerifierError::InvalidPublicInput);
    }
    // Prepare public inputs
    let mut prepared = vk.vk_ic[0];
    for (i, input) in public.inputs.iter().enumerate() {
        if !is_scalar_valid(input) {
            return err!(VerifierError::InvalidPublicInput);
        }
        let mul_res = alt_bn128_multiplication(&[&vk.vk_ic[i + 1][..], &input[..]].concat())
            .map_err(|_| error!(VerifierError::ArithmeticError))?;
        prepared = alt_bn128_addition(&[&mul_res[..], &prepared[..]].concat())
            .unwrap()
            .try_into()
            .map_err(|_| error!(VerifierError::ArithmeticError))?;
    }

    // Perform pairing check
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
    let allowed_control_root: Digest = Digest::from_bytes(ALLOWED_CONTROL_ROOT);
    let bn254_identity_control_id: Digest = Digest::from_bytes(BN254_IDENTITY_CONTROL_ID);

    let (a0, a1) =
        split_digest_bytes(allowed_control_root).map_err(|_| ProgramError::InvalidAccountData)?;
    let (c0, c1) = split_digest_bytes(Digest::from(claim_digest))
        .map_err(|_| ProgramError::InvalidAccountData)?;

    let mut id_bn554 = bn254_identity_control_id.as_bytes().to_vec();
    id_bn554.reverse();
    let id_bn254_fr = to_fixed_array(&id_bn554);

    let inputs = [a0, a1, c0, c1, id_bn254_fr];

    Ok(PublicInputs { inputs })
}

fn split_digest_bytes(d: Digest) -> Result<([u8; 32], [u8; 32])> {
    let big_endian: Vec<u8> = d.as_bytes().iter().rev().copied().collect();
    let middle = big_endian.len() / 2;
    let (b, a) = big_endian.split_at(middle);
    Ok((to_fixed_array(a), to_fixed_array(b)))
}

fn to_fixed_array(input: &[u8]) -> [u8; 32] {
    assert!(input.len() <= 32, "Input length must not exceed 32 bytes");

    let mut fixed_array = [0u8; 32];
    let start_index = 32 - input.len();

    fixed_array[start_index..].copy_from_slice(input);
    fixed_array
}

// TODO: Regarding the scalar check, should modular reduction be used here instead of a error handler?
fn is_scalar_valid(scalar: &[u8; 32]) -> bool {
    for (s_byte, q_byte) in scalar.iter().zip(BASE_FIELD_MODULUS_Q.iter()) {
        match s_byte.cmp(q_byte) {
            std::cmp::Ordering::Less => return true,     // scalar < q
            std::cmp::Ordering::Greater => return false, // scalar > q
            std::cmp::Ordering::Equal => continue,       // check next
        }
    }
    false // scalar == q
}

#[cfg(any(feature = "client", test))]
pub mod client {
    use super::vk::{G1_LEN, G2_LEN};
    use super::Proof;
    use crate::BASE_FIELD_MODULUS_Q;
    use anchor_lang::solana_program::alt_bn128::compression::prelude::convert_endianness;
    use anyhow::{anyhow, Error, Result};
    use ark_serialize::{CanonicalDeserialize, CanonicalSerialize, Compress, Validate};
    use num_bigint::BigUint;
    use risc0_zkvm::{Groth16Receipt, ReceiptClaim};
    use serde::{Deserialize, Deserializer, Serialize};
    use std::{convert::TryInto, fs::File, io::Write};

    type G1 = ark_bn254::g1::G1Affine;
    type G2 = ark_bn254::g2::G2Affine;

    #[derive(Deserialize, Serialize, Debug, PartialEq)]
    struct ProofJson {
        pi_a: Vec<String>,
        pi_b: Vec<Vec<String>>,
        pi_c: Vec<String>,
        protocol: String,
        curve: String,
    }

    #[derive(Deserialize, Serialize, Debug, PartialEq)]
    struct VerifyingKeyJson {
        protocol: String,
        curve: String,
        #[serde(rename = "nPublic")]
        nr_pubinputs: u32,
        vk_alpha_1: Vec<String>,
        vk_beta_2: Vec<Vec<String>>,
        vk_gamma_2: Vec<Vec<String>>,
        vk_delta_2: Vec<Vec<String>>,
        #[serde(rename = "IC")]
        vk_ic: Vec<Vec<String>>,
    }

    impl<'de> Deserialize<'de> for Proof {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            let json = ProofJson::deserialize(deserializer)?;
            Proof::try_from(json).map_err(serde::de::Error::custom)
        }
    }

    impl Serialize for Proof {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            let json = self.to_json().map_err(serde::ser::Error::custom)?;
            json.serialize(serializer)
        }
    }

    impl TryFrom<ProofJson> for Proof {
        type Error = Error;

        fn try_from(json: ProofJson) -> Result<Self, Self::Error> {
            Ok(Proof {
                pi_a: convert_g1(&json.pi_a)?,
                pi_b: convert_g2(&json.pi_b)?,
                pi_c: convert_g1(&json.pi_c)?,
            })
        }
    }

    impl Proof {
        fn to_json(&self) -> Result<ProofJson> {
            Ok(ProofJson {
                pi_a: export_g1(&self.pi_a),
                pi_b: export_g2(&self.pi_b),
                pi_c: export_g1(&self.pi_c),
                protocol: "groth16".to_string(),
                curve: "bn128".to_string(),
            })
        }

        pub fn to_bytes(&self) -> [u8; 256] {
            let mut bytes = [0u8; 256];
            bytes[..64].copy_from_slice(&self.pi_a);
            bytes[64..192].copy_from_slice(&self.pi_b);
            bytes[192..].copy_from_slice(&self.pi_c);
            bytes
        }
    }

    fn export_g1(bytes: &[u8; G1_LEN]) -> Vec<String> {
        let x = BigUint::from_bytes_be(&bytes[..32]);
        let y = BigUint::from_bytes_be(&bytes[32..]);
        vec![x.to_string(), y.to_string(), "1".to_string()]
    }

    fn export_g2(bytes: &[u8; G2_LEN]) -> Vec<Vec<String>> {
        let x_c1 = BigUint::from_bytes_be(&bytes[..32]);
        let x_c0 = BigUint::from_bytes_be(&bytes[32..64]);
        let y_c1 = BigUint::from_bytes_be(&bytes[64..96]);
        let y_c0 = BigUint::from_bytes_be(&bytes[96..]);
        vec![
            vec![x_c0.to_string(), x_c1.to_string()],
            vec![y_c0.to_string(), y_c1.to_string()],
            vec!["1".to_string(), "0".to_string()],
        ]
    }

    pub(crate) fn convert_g1(values: &[String]) -> Result<[u8; G1_LEN]> {
        if values.len() != 3 {
            return Err(anyhow!(
                "Invalid G1 point: expected 3 values, got {}",
                values.len()
            ));
        }

        let x = BigUint::parse_bytes(values[0].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G1 x coordinate"))?;
        let y = BigUint::parse_bytes(values[1].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G1 y coordinate"))?;
        let z = BigUint::parse_bytes(values[2].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G1 z coordinate"))?;

        // check that z == 1
        if z != BigUint::from(1u8) {
            return Err(anyhow!(
                "Invalid G1 point: Z coordinate is not 1 (found {})",
                z
            ));
        }

        let mut result = [0u8; G1_LEN];
        let x_bytes = x.to_bytes_be();
        let y_bytes = y.to_bytes_be();

        result[32 - x_bytes.len()..32].copy_from_slice(&x_bytes);
        result[G1_LEN - y_bytes.len()..].copy_from_slice(&y_bytes);

        Ok(result)
    }

    pub(crate) fn convert_g2(values: &[Vec<String>]) -> Result<[u8; G2_LEN]> {
        if values.len() != 3 || values[0].len() != 2 || values[1].len() != 2 || values[2].len() != 2
        {
            return Err(anyhow!("Invalid G2 point structure"));
        }

        let x_c0 = BigUint::parse_bytes(values[0][0].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G2 x.c0"))?;
        let x_c1 = BigUint::parse_bytes(values[0][1].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G2 x.c1"))?;
        let y_c0 = BigUint::parse_bytes(values[1][0].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G2 y.c0"))?;
        let y_c1 = BigUint::parse_bytes(values[1][1].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G2 y.c1"))?;

        // check z == [1, 0]
        let z_c0 = BigUint::parse_bytes(values[2][0].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G2 z.c0"))?;
        let z_c1 = BigUint::parse_bytes(values[2][1].as_bytes(), 10)
            .ok_or_else(|| anyhow!("Failed to parse G2 z.c1"))?;

        if z_c0 != BigUint::from(1u8) || z_c1 != BigUint::from(0u8) {
            return Err(anyhow!(
                "Invalid G2 point: Z coordinate is not [1, 0] (found [{}, {}])",
                z_c0,
                z_c1
            ));
        }

        let mut result = [0u8; G2_LEN];
        let x_c1_bytes = x_c1.to_bytes_be();
        let x_c0_bytes = x_c0.to_bytes_be();
        let y_c1_bytes = y_c1.to_bytes_be();
        let y_c0_bytes = y_c0.to_bytes_be();

        result[32 - x_c1_bytes.len()..32].copy_from_slice(&x_c1_bytes);
        result[64 - x_c0_bytes.len()..64].copy_from_slice(&x_c0_bytes);
        result[96 - y_c1_bytes.len()..96].copy_from_slice(&y_c1_bytes);
        result[G2_LEN - y_c0_bytes.len()..].copy_from_slice(&y_c0_bytes);

        Ok(result)
    }

    pub fn negate_g1(point: &[u8; 64]) -> Result<[u8; 64], ()> {
        let x = &point[..32];
        let y = &point[32..];

        let mut y_big = BigUint::from_bytes_be(y);
        let field_modulus = BigUint::from_bytes_be(&BASE_FIELD_MODULUS_Q);

        // Negate the y-coordinate to get -g1.
        y_big = field_modulus - y_big;

        // Reconstruct the point with the negated y-coordinate
        let mut result = [0u8; 64];
        result[..32].copy_from_slice(x);
        let y_bytes = y_big.to_bytes_be();
        result[64 - y_bytes.len()..].copy_from_slice(&y_bytes);

        Ok(result)
    }

    pub fn receipt_to_proof(receipt: &Groth16Receipt<ReceiptClaim>) -> Result<Proof, ()> {
        let seal = &receipt.seal;
        if seal.len() < 256 {
            return Err(());
        }

        let mut proof = Proof {
            pi_a: seal[0..64].try_into().map_err(|_| ())?,
            pi_b: seal[64..192].try_into().map_err(|_| ())?,
            pi_c: seal[192..256].try_into().map_err(|_| ())?,
        };

        proof.pi_a = negate_g1(&proof.pi_a)?;
        Ok(proof)
    }

    pub fn write_to_file(filename: &str, proof: &Proof) {
        let mut file = File::create(filename).expect("Failed to create file");
        file.write_all(&proof.pi_a)
            .expect("Failed to write proof_a");
        file.write_all(&proof.pi_b)
            .expect("Failed to write proof_b");
        file.write_all(&proof.pi_c)
            .expect("Failed to write proof_c");
    }

    pub fn write_compressed_proof_to_file(filename: &str, proof: &[u8]) {
        let mut file = File::create(filename).expect("Failed to create file");
        file.write_all(proof).expect("Failed to write proof");
    }

    pub fn compress_g1_be(g1: &[u8; 64]) -> [u8; 32] {
        let g1 = convert_endianness::<32, 64>(g1);
        let mut compressed = [0u8; 32];
        let g1 = G1::deserialize_with_mode(g1.as_slice(), Compress::No, Validate::Yes).unwrap();
        G1::serialize_with_mode(&g1, &mut compressed[..], Compress::Yes).unwrap();
        convert_endianness::<32, 32>(&compressed)
    }

    pub fn compress_g2_be(g2: &[u8; 128]) -> [u8; 64] {
        let g2: [u8; 128] = convert_endianness::<64, 128>(g2);
        let mut compressed = [0u8; 64];
        let g2 = G2::deserialize_with_mode(g2.as_slice(), Compress::No, Validate::Yes).unwrap();
        G2::serialize_with_mode(&g2, &mut compressed[..], Compress::Yes).unwrap();
        convert_endianness::<64, 64>(&compressed)
    }
}

#[cfg(test)]
mod test_lib {
    use super::client::*;
    use super::*;
    use risc0_zkvm::sha::Digestible;
    use risc0_zkvm::Receipt;

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
        proof.pi_a = negate_g1(&proof.pi_a).unwrap();

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
        let res = verify_groth_proof(&proof, &public_inputs);
        assert!(res.is_ok(), "Verification failed");
    }

    #[test]
    fn test_write_compressed_proof_to_file() {
        let (_, proof, _) = load_receipt_and_extract_data();

        let compressed_proof_a = compress_g1_be(&proof.pi_a);
        let compressed_proof_b = compress_g2_be(&proof.pi_b);
        let compressed_proof_c = compress_g1_be(&proof.pi_c);

        let compressed_proof = [
            compressed_proof_a.as_slice(),
            compressed_proof_b.as_slice(),
            compressed_proof_c.as_slice(),
        ]
        .concat();

        write_compressed_proof_to_file("test/data/compressed_proof.bin", &compressed_proof);
    }

    #[test]
    fn test_scalar_validity_check() {
        let valid_scalar = [0u8; 32];
        assert!(is_scalar_valid(&valid_scalar), "Zero should be valid");

        let mut invalid_scalar = BASE_FIELD_MODULUS_Q;
        assert!(!is_scalar_valid(&invalid_scalar), "q should be invalid");

        invalid_scalar[31] += 1;
        assert!(!is_scalar_valid(&invalid_scalar), "q+1 should be invalid");

        let mut below_q = BASE_FIELD_MODULUS_Q;
        below_q[31] -= 1;
        assert!(is_scalar_valid(&below_q), "q-1 should be valid");
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
            actual_claim_digest.as_bytes(), calculated_claim_digest,
            "Claim digests do not match"
        );
    }
    
}
