# RISC Zero Solana Groth16 Verifier

> **This is unaudited and not for production.**

A RISC Zero Groth16 SNARK verifier, compatible with Solana. It provides functionality for utilizing and verifying RISC Zero proofs on the Solana blockchain.

## Usage

### Verifying a Proof

```rust
let proof: Proof = // ... load or deserialize proof
let public_inputs: PublicInputs<N> = // ... load or deserialize public inputs
let vk: VerificationKey = // ... load or deserialize verification key

let mut verifier: Verifier<N> = Verifier::new(&proof, &public_inputs, &vk);
let is_valid = verifier.verify().expect("Failed to verify proof");
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
