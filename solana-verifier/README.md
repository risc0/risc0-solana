# Solana Zero-Knowledge Proof Verifier Router

A flexible and secure system for managing zero-knowledge proof verifications on Solana. This project provides a router-based verification system with non-upgradeable verifiers that have emergency controls, and comprehensive administration tools.

## Overview

The Verifier Router system enables:
- Dynamic registration and routing of ZK proof verifiers
- Emergency stop mechanisms with both centralized and decentralized triggers
- Flexible ownership controls with two-step transfers

Comprehensive script support for program management:
- Supports both local key signers and Fireblocks HSM
- Supports adding additional verifiers beyond the currently supported Groth_16 program
- Ownership management and transfer 
- Emergency Stop by owner 

## Getting Started

### Prerequisites
- Rust and Cargo
- Solana Tool Suite
- Node.js and Yarn
- Anchor Framework

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd verifier-router
```

2. Install dependencies:
```bash
yarn install
```

3. Configure environment:
```bash
cp example.env .env
# Edit .env with your configuration
```

### Deployment
Note: Deployment accounts need at minimum a 6 SOL balance by default and
any non-deployment actions require an account with a 1 SOL minimum balance.


1. Deploy the router and initial verifier:
```bash
anchor keys sync
anchor build
yarn run client
yarn run deploy
```

2. (Optional) Add additional verifiers programs:
```bash
yarn run add
```

## System Architecture

### Components

1. **Router Program**: Central registry and routing system
2. **Verifier Programs**: Individual verifier implementations (e.g., Groth16)
3. **Client Programs**: Programs that use the router for proof verification

## Implementation Example

```rust
#[derive(Accounts)]
pub struct IncrementNonce<'info> {
    #[account(mut)]
    pub program_data: Account<'info, ProgramData>,
    pub router: Program<'info, VerifierRouterProgram>,
    pub router_account: Account<'info, VerifierRouter>,
    #[account(
        seeds = [
            b"verifier",
            &program_data.selector.to_le_bytes()
        ],
        bump,
        seeds::program = verifier_router::ID,
    )]
    pub verifier_entry: Account<'info, VerifierEntry>,
    pub verifier_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

 pub fn increment_nonce(
        ctx: Context<IncrementNonce>,
        proof: Proof,
        journal_nonce: u32,
    ) -> Result<()> {
        // Your programs initial code...

        // Next we collect the accounts necessary for making the CPI call to the Risc0 Proof Verifier program
        let cpi_accounts = Verify {
            router: ctx.accounts.router_account.to_account_info(),
            verifier_entry: ctx.accounts.verifier_entry.to_account_info(),
            verifier_program: ctx.accounts.verifier_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        // We hash our journal outputs that we used for our earlier requirements to get a journal digest
        let journal_digest = hashv(&[&journal_nonce.to_le_bytes()]).to_bytes();

        // We collect the image ID that our program is expecting our proof to match so that an attacker cannot use
        // a proof generated from a modified program
        let image_id = ctx.accounts.program_data.image_id;

        // We pass the selector for the proof verifier that we are currently using
        let selector = ctx.accounts.program_data.selector;

        // We setup our CPI context for the router
        let cpi_ctx = CpiContext::new(ctx.accounts.router.to_account_info(), cpi_accounts);

        // We make the CPI call to the Risc0 Verifier Router which if it returns means the proof is valid
        // In Solana you cannot recover from a CPI call which returns an error, to make this clear I explicitly unwrap although
        // behavior would be the same if I ignored the result.
        verifier_router::cpi::verify(cpi_ctx, selector, proof, image_id, journal_digest).unwrap();

        // Your programs code after a successful verification...
    }
```

## Administrative Functions

### Router Management

1. Transfer Ownership:
```bash
NEW_OWNER=<pubkey> yarn run transfer
yarn run accept  # Run on new owner's machine
```

2. Add Verifier:
```bash
VERIFIER_ADDRESS=<address> yarn run add
```

3. Emergency Stop:
```bash
yarn run estop  # Follow prompts
```

## Development Tools

### Scripts
All scripts have values set in the environment, see `example.env` for a full
list of options.

- `yarn run deploy`: Deploy programs
- `yarn run add`: Add new verifier
- `yarn run estop`: Emergency stop by owner
- `yarn run transfer`: Transfer ownership
- `yarn run accept`: Accept ownership
- `yarn run renounce`: Renounce ownership
- `yarn run client`: Generate TypeScript clients

### Environment Variables

See `example.env` for full configuration options including:
- Network endpoints
- Account addresses
- Deployment settings
- Fireblocks integration (optional)

## Testing

Open a terminal and run a local validator:
```bash
solana-test-validator -r
```

Then in another terminal run:
```bash
anchor test --skip-local-validator
```