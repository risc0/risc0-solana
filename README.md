# RISC Zero Solana Groth16 Verifier

> **This is unaudited and not for production use.**

A RISC Zero Groth16 SNARK verifier compatible with Solana. This library provides functionality for verifying RISC Zero proofs on the Solana blockchain.

## Usage

### Verifying a Proof

```rust
use risc0_groth16_verifier::{verify_proof, Proof, PublicInputs, VerificationKey};

let proof: Proof = // ... load or deserialize proof
let public_inputs: PublicInputs<5> = // ... load or deserialize public inputs
let vk: VerificationKey = // ... load or deserialize verification key

let result = verify_proof(&proof, &public_inputs, &vk);
assert!(result.is_ok(), "Proof verification failed");
```

### Generating Public Inputs

```rust
use risc0_groth16_verifier::public_inputs;

let claim_digest: [u8; 32] = // ... obtain claim digest
let allowed_control_root: &str = // ... specify allowed control root
let bn254_identity_control_id: &str = // ... specify BN254 identity control ID

let public_inputs = public_inputs(claim_digest, allowed_control_root, bn254_identity_control_id)?;
```

### Working with Proofs and Verification Keys

The library provides utilities for serializing and deserializing proofs and verification keys:

```rust
use risc0_groth16_verifier::client::{Proof, VerificationKey};

// Serialize to JSON
let proof_json = serde_json::to_string(&proof)?;
let vk_json = serde_json::to_string(&vk)?;

// Deserialize from JSON
let proof: Proof = serde_json::from_str(&proof_json)?;
let vk: VerificationKey = serde_json::from_str(&vk_json)?;
```

## Client-side Utilities

The library includes client-side utilities for working with proofs and verification keys:

- Compression of G1 and G2 points
- Conversion between JSON and binary formats
- Writing proofs and verification keys to files

## Testing

The library includes a non-exhaustive test suite. Run the tests using:

```
cargo test
```

## Acknowledgments

- Light Protocol [groth16-solana](https://github.com/Lightprotocol/groth16-solana/tree/master)
- [Solana Foundation](https://solana.org/grants-funding)

## License

This project is licensed under the Apache2 license. See [LICENSE](./LICENSE).
