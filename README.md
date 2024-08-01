# RISC Zero Solana Groth16 Verifier=

> **This is unaudited and not for production.**

A RISC Zero Groth16 SNARK verifier, compatible with Solana. It provides functionality for utilizing and verifying RISC Zero proofs on the Solana blockchain.

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

The repository includes tests. Run the tests using:

```
cargo test -p <PACKAGE>
```

## Dependencies

- `solana_program`: For Solana program compatibility
- `serde`: For JSON serialization/deserialization
- `ark_bn254`: For BN254 curve operations
- `num_bigint`: For big integer arithmetic
