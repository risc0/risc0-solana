use super::vk::{G1_LEN, G2_LEN};
use super::{negate_g1, Proof};
use anyhow::{anyhow, Error, Result};
use num_bigint::BigUint;
use risc0_zkvm::{Groth16Receipt, ReceiptClaim};
use serde::{Deserialize, Deserializer, Serialize};

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
    if values.len() != 3 || values[0].len() != 2 || values[1].len() != 2 || values[2].len() != 2 {
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

    proof.pi_a = negate_g1(&proof.pi_a);
    Ok(proof)
}