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

## Acknowledgments

- Light Protocol [groth16-solana](https://github.com/Lightprotocol/groth16-solana/tree/master)

- [Solana Foundation](https://solana.org/grants-funding) 