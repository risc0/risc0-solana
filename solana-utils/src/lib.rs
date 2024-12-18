use num_bigint::BigUint;
use risc0_zkvm::{Groth16Receipt, Groth16Seal, ReceiptClaim};

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
