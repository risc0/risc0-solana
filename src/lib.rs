use borsh::{BorshDeserialize, BorshSerialize};
use risc0_zkp::core::digest::Digest;
use solana_program::alt_bn128::compression::prelude::{
    alt_bn128_g1_decompress, alt_bn128_g2_decompress,
};
use solana_program::alt_bn128::prelude::{
    alt_bn128_addition, alt_bn128_multiplication, alt_bn128_pairing,
};
use solana_program::entrypoint::ProgramResult;
use solana_program::program_error::ProgramError;

#[cfg(not(target_os = "solana"))]
use {
    anyhow::{anyhow, Error, Result},
    ark_serialize::{CanonicalDeserialize, CanonicalSerialize, Compress, Validate},
    num_bigint::BigUint,
    serde::{Deserialize, Deserializer, Serialize},
    solana_program::alt_bn128::compression::prelude::convert_endianness,
    std::{convert::TryInto, fs::File, io::Write},
};

const G1_LEN: usize = 64;
const G2_LEN: usize = 128;

pub struct Verifier<'a, const N_PUBLIC: usize> {
    proof: &'a Proof,
    public: &'a PublicInputs<N_PUBLIC>,
    vk: &'a VerificationKey<'a>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Proof {
    pub pi_a: [u8; 64],
    pub pi_b: [u8; 128],
    pub pi_c: [u8; 64],
}

#[derive(Debug, Clone, PartialEq, Eq, BorshSerialize)]
pub struct VerificationKey<'a> {
    pub nr_pubinputs: u32,
    pub vk_alpha_g1: [u8; G1_LEN],
    pub vk_beta_g2: [u8; G2_LEN],
    pub vk_gamma_g2: [u8; G2_LEN],
    pub vk_delta_g2: [u8; G2_LEN],
    pub vk_ic: &'a [[u8; G1_LEN]],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicInputs<const N: usize> {
    pub inputs: [[u8; 32]; N],
}

pub fn decompress_g1(g1_bytes: &[u8; 32]) -> Result<[u8; 64], ProgramError> {
    alt_bn128_g1_decompress(g1_bytes).map_err(|_| ProgramError::InvalidArgument)
}

pub fn decompress_g2(g2_bytes: &[u8; 64]) -> Result<[u8; 128], ProgramError> {
    alt_bn128_g2_decompress(g2_bytes).map_err(|_| ProgramError::InvalidArgument)
}

impl<'a, const N_PUBLIC: usize> Verifier<'a, N_PUBLIC> {
    pub fn new(
        proof: &'a Proof,
        public: &'a PublicInputs<N_PUBLIC>,
        vk: &'a VerificationKey<'a>,
    ) -> Self {
        Self { proof, public, vk }
    }

    pub fn verify(&self) -> ProgramResult {
        let prepared_public = self.prepare_public_inputs()?;
        self.perform_pairing(&prepared_public)
    }

    fn prepare_public_inputs(&self) -> Result<[u8; 64], ProgramError> {
        let mut prepared = self.vk.vk_ic[0];
        for (i, input) in self.public.inputs.iter().enumerate() {
            let mul_res =
                alt_bn128_multiplication(&[&self.vk.vk_ic[i + 1][..], &input[..]].concat())
                    .unwrap();
            prepared = alt_bn128_addition(&[&mul_res[..], &prepared[..]].concat())
                .unwrap()
                .try_into()
                .map_err(|_| ProgramError::InvalidArgument)?;
        }
        Ok(prepared)
    }

    fn perform_pairing(&self, prepared_public: &[u8; 64]) -> ProgramResult {
        let pairing_input = [
            self.proof.pi_a.as_slice(),
            self.proof.pi_b.as_slice(),
            prepared_public.as_slice(),
            self.vk.vk_gamma_g2.as_slice(),
            self.proof.pi_c.as_slice(),
            self.vk.vk_delta_g2.as_slice(),
            self.vk.vk_alpha_g1.as_slice(),
            self.vk.vk_beta_g2.as_slice(),
        ]
        .concat();

        let pairing_res = alt_bn128_pairing(&pairing_input).unwrap();

        if pairing_res[31] != 1 {
            return Err(ProgramError::Custom(2));
        }

        Ok(())
    }
}

fn digest_from_hex(hex_str: &str) -> Digest {
    let bytes = hex::decode(hex_str).expect("Invalid hex string");
    Digest::from_bytes(bytes.try_into().expect("Invalid digest length"))
}

pub fn public_inputs<const N: usize>(
    claim_digest: Digest,
) -> Result<PublicInputs<N>, ProgramError> {
    let allowed_control_root: Digest =
        digest_from_hex("a516a057c9fbf5629106300934d48e0e775d4230e41e503347cad96fcbde7e2e");
    let bn254_identity_control_id: Digest =
        digest_from_hex("51b54a62f2aa599aef768744c95de8c7d89bf716e11b1179f05d6cf0bcfeb60e");

    let (a0, a1) =
        split_digest_bytes(allowed_control_root).map_err(|_| ProgramError::InvalidAccountData)?;
    let (c0, c1) =
        split_digest_bytes(claim_digest).map_err(|_| ProgramError::InvalidAccountData)?;

    let mut id_bn554 = bn254_identity_control_id.as_bytes().to_vec();
    id_bn554.reverse();
    let id_bn254_fr =
        from_u256_hex(&hex::encode(id_bn554)).map_err(|_| ProgramError::InvalidAccountData)?;

    let input_vec = [a0, a1, c0, c1, id_bn254_fr];

    if N != input_vec.len() {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut inputs = [[0u8; 32]; N];
    for (i, input) in input_vec.into_iter().enumerate() {
        inputs[i] = input.try_into().unwrap();
    }
    Ok(PublicInputs { inputs })
}

fn split_digest_bytes(d: Digest) -> Result<(Vec<u8>, Vec<u8>), anyhow::Error> {
    let big_endian: Vec<u8> = d.as_bytes().to_vec().iter().rev().cloned().collect();
    let middle = big_endian.len() / 2;
    let (b, a) = big_endian.split_at(middle);
    Ok((
        from_u256_hex(&hex::encode(a))?,
        from_u256_hex(&hex::encode(b))?,
    ))
}

fn from_u256_hex(value: &str) -> Result<Vec<u8>, anyhow::Error> {
    Ok(to_fixed_array(
        hex::decode(value).map_err(|_| anyhow::anyhow!("conversion from u256 failed"))?,
    )
    .to_vec())
}

fn to_fixed_array(input: Vec<u8>) -> [u8; 32] {
    let mut fixed_array = [0u8; 32];
    let start = core::cmp::max(32, input.len()) - core::cmp::min(32, input.len());
    fixed_array[start..].copy_from_slice(&input[input.len().saturating_sub(32)..]);
    fixed_array
}

#[cfg(not(target_os = "solana"))]
pub mod non_solana {
    use super::*;

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

    impl<'de> Deserialize<'de> for VerificationKey<'_> {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            let json = VerifyingKeyJson::deserialize(deserializer)?;
            VerificationKey::try_from(json).map_err(serde::de::Error::custom)
        }
    }

    impl<'de, const N: usize> Deserialize<'de> for PublicInputs<N> {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
        {
            let inputs: Vec<String> =
                <Vec<String> as serde::Deserialize>::deserialize(deserializer)?;
            PublicInputs::try_from(inputs).map_err(serde::de::Error::custom)
        }
    }

    impl Serialize for VerificationKey<'_> {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            let json = self.to_json().map_err(serde::ser::Error::custom)?;
            json.serialize(serializer)
        }
    }

    impl<const N: usize> Serialize for PublicInputs<N> {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            let strings: Vec<String> = self
                .inputs
                .iter()
                .map(|input| BigUint::from_bytes_be(input).to_string())
                .collect();
            serde::Serialize::serialize(&strings, serializer)
        }
    }

    impl<'a> TryFrom<VerifyingKeyJson> for VerificationKey<'a> {
        type Error = Error;

        fn try_from(json: VerifyingKeyJson) -> Result<Self, Self::Error> {
            let vk_ic: Vec<[u8; G1_LEN]> = json
                .vk_ic
                .iter()
                .map(|ic| convert_g1(ic))
                .collect::<Result<Vec<_>, _>>()?;

            // Make sure vk_ic lives long enough
            let vk_ic_box = Box::new(vk_ic);
            let vk_ic_ref: &'a [[u8; G1_LEN]] = Box::leak(vk_ic_box);

            Ok(VerificationKey {
                nr_pubinputs: json.nr_pubinputs,
                vk_alpha_g1: convert_g1(&json.vk_alpha_1)?,
                vk_beta_g2: convert_g2(&json.vk_beta_2)?,
                vk_gamma_g2: convert_g2(&json.vk_gamma_2)?,
                vk_delta_g2: convert_g2(&json.vk_delta_2)?,
                vk_ic: vk_ic_ref,
            })
        }
    }

    impl<const N: usize> TryFrom<Vec<String>> for PublicInputs<N> {
        type Error = Error;

        fn try_from(inputs: Vec<String>) -> Result<Self, Self::Error> {
            if inputs.len() != N {
                return Err(anyhow!("Invalid number of public inputs"));
            }

            let parsed_inputs = inputs
                .into_iter()
                .map(|input| {
                    let biguint = BigUint::parse_bytes(input.as_bytes(), 10)
                        .ok_or_else(|| anyhow!("Failed to parse input: {}", input))?;
                    let mut bytes = [0u8; 32];
                    let be_bytes = biguint.to_bytes_be();
                    bytes[32 - be_bytes.len()..].copy_from_slice(&be_bytes);
                    Ok(bytes)
                })
                .collect::<Result<Vec<_>, Error>>()?;

            Ok(PublicInputs {
                inputs: parsed_inputs
                    .try_into()
                    .map_err(|_| anyhow!("Conversion failed"))?,
            })
        }
    }

    impl<'a> VerificationKey<'a> {
        fn to_json(&self) -> Result<VerifyingKeyJson> {
            Ok(VerifyingKeyJson {
                protocol: "groth16".to_string(),
                curve: "bn128".to_string(),
                nr_pubinputs: self.nr_pubinputs,
                vk_alpha_1: export_g1(&self.vk_alpha_g1),
                vk_beta_2: export_g2(&self.vk_beta_g2),
                vk_gamma_2: export_g2(&self.vk_gamma_g2),
                vk_delta_2: export_g2(&self.vk_delta_g2),
                vk_ic: self.vk_ic.iter().map(export_g1).collect(),
            })
        }
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
    fn convert_g1(values: &[String]) -> Result<[u8; G1_LEN]> {
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

        let mut result = [0u8; G1_LEN];
        let x_bytes = x.to_bytes_be();
        let y_bytes = y.to_bytes_be();

        result[32 - x_bytes.len()..32].copy_from_slice(&x_bytes);
        result[G1_LEN - y_bytes.len()..].copy_from_slice(&y_bytes);

        Ok(result)
    }

    fn convert_g2(values: &[Vec<String>]) -> Result<[u8; G2_LEN]> {
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

    type G1 = ark_bn254::g1::G1Affine;
    type G2 = ark_bn254::g2::G2Affine;

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

    pub fn negate_g1(point: &[u8; 64]) -> Result<[u8; 64], Error> {
        let x = &point[..32];
        let y = &point[32..];

        let mut y_big = BigUint::from_bytes_be(y);

        // Negate y: y = FIELD_MODULUS - y
        // Base field: q = 21888242871839275222246405745257275088696311157297823662689037894645226208583
        // https://docs.rs/ark-bn254/latest/ark_bn254/
        let field_modulus = BigUint::parse_bytes(
            b"21888242871839275222246405745257275088696311157297823662689037894645226208583",
            10,
        )
        .ok_or_else(|| anyhow!("Failed to parse field modulus"))?;
        y_big = field_modulus - y_big;

        let mut result = [0u8; 64];
        result[..32].copy_from_slice(x);
        let y_bytes = y_big.to_bytes_be();
        result[64 - y_bytes.len()..].copy_from_slice(&y_bytes);

        Ok(result)
    }
}

#[cfg(test)]
mod test_lib {
    use super::non_solana::*;
    use super::*;

    #[test]
    fn test_import() {
        let vk_json_str = include_str!("../test/data/r0_test_vk.json");
        let vk: VerificationKey = serde_json::from_str(&vk_json_str).unwrap();
        println!("{:?}", vk);
    }

    #[test]
    fn test_roundtrip() {
        let vk_json_str = include_str!("../test/data/r0_test_vk.json");
        let vk: VerificationKey = serde_json::from_str(&vk_json_str).unwrap();

        let exported_json = serde_json::to_string(&vk).unwrap();
        let reimported_vk: VerificationKey = serde_json::from_str(&exported_json).unwrap();

        assert_eq!(vk, reimported_vk, "Roundtrip serialization failed");
    }

    #[test]
    fn test_public_inputs() {
        let inputs_json_str = include_str!("../test/data/r0_test_public.json");

        let public_inputs: PublicInputs<5> = serde_json::from_str(&inputs_json_str).unwrap();
        println!("{:?}", public_inputs);

        // Test roundtrip
        let exported_json = serde_json::to_string(&public_inputs).unwrap();
        println!("{:?}", exported_json);
        let reimported_inputs: PublicInputs<5> = serde_json::from_str(&exported_json).unwrap();
        assert_eq!(
            public_inputs, reimported_inputs,
            "Public Inputs roundtrip failed"
        );
    }

    #[test]
    fn test_proof() {
        let proof_json_str = include_str!("../test/data/r0_test_proof.json");

        let proof: Proof = serde_json::from_str(proof_json_str).unwrap();
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
        let proof_json_str = include_str!("../test/data/r0_test_proof.json");
        let mut proof: Proof = serde_json::from_str(proof_json_str).unwrap();

        proof.pi_a = negate_g1(&proof.pi_a).unwrap();

        let inputs_json_str = include_str!("../test/data/r0_test_public.json");
        let public_inputs: PublicInputs<5> = serde_json::from_str(&inputs_json_str).unwrap();
        let vk_json_str = include_str!("../test/data/r0_test_vk.json");
        let vk: VerificationKey = serde_json::from_str(&vk_json_str).unwrap();

        let verifier: Verifier<5> = Verifier::new(&proof, &public_inputs, &vk);

        verifier.verify().unwrap();
    }

    #[test]
    fn test_write_compressed_proof_to_file() {
        let proof_str = include_str!("../test/data/r0_test_proof.json");
        let mut proof: Proof = serde_json::from_str(&proof_str).unwrap();

        proof.pi_a = negate_g1(&proof.pi_a).unwrap();

        let compressed_proof_a = compress_g1_be(&proof.pi_a);
        let compressed_proof_b = compress_g2_be(&proof.pi_b);
        let compressed_proof_c = compress_g1_be(&proof.pi_c);

        let proof = [
            compressed_proof_a.as_slice(),
            compressed_proof_b.as_slice(),
            compressed_proof_c.as_slice(),
        ]
        .concat();

        write_compressed_proof_to_file("test/data/compressed_proof.bin", &proof);
    }
}
