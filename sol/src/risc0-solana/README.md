# RISC Zero Groth16 Solana Verifier

This repository contains an implementation of a Groth16 proof verifier compatible with Solana programs. It provides functionality for importing, exporting, and verifying Groth16 proofs on the Solana blockchain.

## Features

- Groth16 proof verification
- Compatibility with Solana programs
- Support for importing and exporting proofs and verification keys in JSON format
- Compressed and uncompressed point representations
- Utility functions for point compression, decompression, and negation

## Usage

### Verifying a Proof

```rust
let proof: Proof = // ... load or deserialize proof
let public_inputs: PublicInputs<N> = // ... load or deserialize public inputs
let vk: VerificationKey = // ... load or deserialize verification key

let mut verifier: Verifier<N> = Verifier::new(&proof, &public_inputs, &vk);
let is_valid = verifier.verify().unwrap();
```

### Importing/Exporting JSON

The `Proof`, `VerificationKey`, and `PublicInputs` structs implement `Serialize` and `Deserialize` traits, allowing easy conversion to and from JSON:

```rust
// Importing
let vk: VerificationKey = serde_json::from_str(&vk_json_str).unwrap();
let public_inputs: PublicInputs<5> = serde_json::from_str(&inputs_json_str).unwrap();
let proof: Proof = serde_json::from_str(&proof_json_str).unwrap();

// Exporting
let exported_json = serde_json::to_string(&vk).unwrap();
```

### Point Compression

The library provides functions for compressing and decompressing elliptic curve points:

```rust
let compressed_g1 = compress_g1_be(&uncompressed_g1);
let compressed_g2 = compress_g2_be(&uncompressed_g2);

let decompressed_g1 = decompress_g1(&compressed_g1).unwrap();
let decompressed_g2 = decompress_g2(&compressed_g2).unwrap();
```

## Testing

The repository includes a comprehensive test suite. Run the tests using:

```
cargo test
```

## Dependencies

- `solana_program`: For Solana program compatibility
- `serde`: For JSON serialization/deserialization
- `ark_bn254`: For BN254 curve operations
- `num_bigint`: For big integer arithmetic

## Note

This verifier is unaudited and not for production.