# Hello Example

This is an e2e example, containing a a RISC Zero zkVM guest, host, and a Solana Program. The guest produces a proof that is prepared, exported, and verified within a Solana program using the `risc0-solana` library. 

## Getting Started

The steps below will guide you through setting up a Solana, deploying and testing, and general configuration. These instructions will likely change as the library and process mature.

### Solana Setup

Download Solana:
```
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

Initialize the library and test-validator version. 

Note: this must match the version defined in the project (i.e. `1.18.20`).

```
solana-install init <VERSION>
```

For a fresh installation, you are required to generate a new keypair. 

```
solana-keygen new
```

Set the keypair path:

```
solana config set --keypair <PATH TO KEYPAIR>
```

Now that Solana is installed, we can spin up a local node or connect to the devnet.

For local testing, configure Solana to connect to `localhost`

```
solana config set --url localhost
```

To test on the devnet, configure Solana to the correct API. 

```
solana config set --url https://api.devnet.solana.com
```

To run a local test node, open a new terminal instance and run:

```
solana-test-validator
```

In order to log the network, we can simply run:

```
solana logs
```

### Program

The program is defined in the `src/lib.rs` file, along with some example data in the `data` directory. 

To interact with the compile, deploy, test, you can utilize the bun scripts. 



```
bun run clean:program   // Cleans the build dir
bun run test:program    // Test the program with BPF
bun run build:program   // Builds the program with BPF
bun run deploy:program  // Deploys the program
```

If you'd like to interact with the deployed Solana program (locally), use the `main.ts` script, which initializes the verification keys and verifies a proof, onchain. 

You can run this script with: 

```
bun run start
```


### zkVM

The guest is the default template example. The host is configured to use Bonsai and the STARK2SNARK pipeline to produce a proof. We export this receipt to a file to be used in some of the tests.

You can run the zkVM program from the root by running: 

```
BONSAI_API_KEY=<YOUR_API_KEY> BONSAI_API_URL=<API_URL> cargo run -p host
```

This will write a receipt to the test directory. Carefully insepct the tests to understand the necessary pre-processing and compression steps to verify this receipt onchain. 
