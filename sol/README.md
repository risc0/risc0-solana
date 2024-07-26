# Solana Exploration 

There are a few directories to keep in mind.

### `client`

1. `client` this is the TS client to interact with the RPC network using solana's JS sdk. The client also includes a few extra scripts for quality of life.

We use bun as the engine.

```
bun run clean:program   // Cleans the build dir
bun run build:program   // Builds the program with cargo build-sbf
bun run deploy:program  // Deploys the program to the defined network
```

To interact with the program, check `main.ts` for implementation. Interact with the deployed program with:

```
bun run start
```


### `program`

2. `program` is the Solana contract. It the program that is deployed on chain once it is built. I recommend using the node scripts to build, deploy, etc.

to build:

```
cargo build-bpf
```

to deploy:

```
solana program deploy target/deploy/<PROGRAM>.so
```

### `risc0-solana`

3. `risc0-solana` is a solana groth16 verification library, using solana's `altbn_128` syscalls. It supports a wide-array of functionality for solana proof verification with RISC Zero. Look at the readme for more info. 

```
cargo test
```

### `test-r0-vm`

4. `test-r0-vm` is to create proofs, and hacked together verification keys and public inputs to be fed into the prepocessor, so we can export the proof, verification key, and public inputs as JSON. Its a hack. 
---

## Solana Setup Instructions:

Download solana CLI:
```
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

Export solana path:
(with fish):

```
set PATH "/Users/hans/.local/share/solana/install/active_release/bin:$PATH"
```

Initialize the version:

```
solana-install init <VERSION>
```

Generate new key:

```
solana-keygen new
```

Set config:

```
solana config set --keypair <PATH TO KEYPAIR>
```

Set url:
- localhost:
```
solana config set --url localhost
```
- devnet:
```
solana config set --url https://api.devnet.solana.com
```

Run local node:

```
solana-test-validator
```

To log network:

```
solana logs
```

Airdrop tokens (local or devnet):

```
solana airdrop <SOL AMT>
```

Check balance:

```
solana balance
```

Check cluster version:

```
solana cluster-version
```

Dev:

```
Cargo toml:
[package]
name = "program"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "1.17.14"

[lib]
crate-type = ["cdylib", "lib"]
```

(make sure the version matches the cluster version and initilized version)



show programs you've deployed on network:

```
solana program show --programs
```
