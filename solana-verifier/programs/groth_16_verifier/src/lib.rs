use anchor_lang::prelude::*;
use anchor_lang::solana_program::alt_bn128::prelude::{
    alt_bn128_addition, alt_bn128_multiplication, alt_bn128_pairing,
};
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::system_program;
use error::VerifierError;
use risc0_zkp::core::digest::Digest;

mod error;
mod vk;

pub use vk::{VerificationKey, VERIFICATION_KEY};

declare_id!("EsJUxZK9qexcHRXr1dVoxt2mUhVAyaoRWBaaRxH5zQJD");

const ALLOWED_CONTROL_ROOT: &str =
    "8b6dcf11d463ac455361b41fb3ed053febb817491bdea00fdb340e45013b852e";
const BN254_IDENTITY_CONTROL_ID: &str =
    "4e160df1e119ac0e3d658755a9edf38c8feb307b34bc10b57f4538dbe122a005";

// Base field modulus `q` for BN254
// https://docs.rs/ark-bn254/latest/ark_bn254/
pub(crate) const BASE_FIELD_MODULUS_Q: [u8; 32] = [
    0x30, 0x64, 0x4E, 0x72, 0xE1, 0x31, 0xA0, 0x29, 0xB8, 0x50, 0x45, 0xB6, 0x81, 0x81, 0x58, 0x5D,
    0x97, 0x81, 0x6A, 0x91, 0x68, 0x71, 0xCA, 0x8D, 0x3C, 0x20, 0x8C, 0x16, 0xD8, 0x7C, 0xFD, 0x47,
];

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

    let public_inputs = public_inputs(
        claim_digest,
        ALLOWED_CONTROL_ROOT,
        BN254_IDENTITY_CONTROL_ID,
    )?;

    verify_groth_proof(proof, &public_inputs)
}

pub fn compute_journal_digest(journal: &[u8]) -> [u8; 32] {
    let journal_digest = hashv(&[journal]);
    journal_digest.to_bytes()
}

pub fn compute_claim_digest(image_id: &[u8; 32], journal_digest: &[u8; 32]) -> [u8; 32] {
    // Hash the Image ID and the journal inputs
    let journal_digest = hashv(&[image_id, journal_digest]);

    journal_digest.to_bytes()
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

pub fn public_inputs(
    claim_digest: [u8; 32],
    allowed_control_root: &str,
    bn254_identity_control_id: &str,
) -> Result<PublicInputs<5>> {
    let allowed_control_root: Digest = digest_from_hex(allowed_control_root);
    let bn254_identity_control_id: Digest = digest_from_hex(bn254_identity_control_id);

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

fn digest_from_hex(hex_str: &str) -> Digest {
    let bytes = hex::decode(hex_str).expect("Invalid hex string");
    Digest::from_bytes(bytes.try_into().expect("Invalid digest length"))
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

#[cfg(feature = "client")]
pub mod client {
    use super::Proof;
    use crate::BASE_FIELD_MODULUS_Q;
    use num_bigint::BigUint;
    use risc0_zkvm::{Groth16Receipt, ReceiptClaim};

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
}
