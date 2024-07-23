# Solana Exploration 

There are a few directories to keep in mind.

### `src/client`

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


### `src/program`

2. `program` is the Solana contract. It the program that is deployed on chain once it is built. I recommend using the node scripts to build, deploy, etc.

to build:

```
cargo build-bpf
```

to deploy:

```
solana program deploy target/deploy/<PROGRAM>.so
```

### `src/sol-r0`

3. `sol-r0` is the zkVM program and host code. It currently is the default guest program, and the host is using the `bonsai-sdk` to generate the snark proofs. The proof is written to a `receipt.json` file when the host is ran.

```
cargo run
```

### `test-groth16-lib`

4. This is to test and toy-around with Light Protocols [`groth16-solana`](https://github.com/Lightprotocol/groth16-solana/tree/master) crate.

---

## Setup Instructions:

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
