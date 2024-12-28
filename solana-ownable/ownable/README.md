# Ownable for Anchor

A Rust library that provides secure two-step ownership transfer functionality for Solana programs built with the Anchor framework. This implementation follows similar patterns to OpenZeppelin's Ownable2Step contract while leveraging Anchor's account system.

## Features

- Two-step ownership transfer process to prevent accidental transfers
- Ownership renouncement capability
- Transfer cancellation by either current or pending owner
- Full test coverage
- Minimal additional account space (66 bytes)
- Derive macro for easy integration

## Installation

Add the following to your program's `Cargo.toml`:

```toml
[dependencies]
# TODO: crate not yet published
```

## Usage

1. Add the `Ownable` derive macro to your account struct and include an `ownership` field:

```rust
use ownable::*;

#[account]
#[derive(Ownable)]
pub struct MyAccount {
    pub ownership: Ownership,  // Must be named "ownership"
    // ... other fields
}
```

2. Implement the required instruction handlers in your program:

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Initialize ownership with the authority's public key
        ctx.accounts.state.ownership = Ownership::new(ctx.accounts.authority.key())?;
        Ok(())
    }

    pub fn transfer_ownership(
        ctx: Context<MyAccountTransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        MyAccount::transfer_ownership(ctx, new_owner)
    }

    pub fn accept_ownership(ctx: Context<MyAccountAcceptOwnership>) -> Result<()> {
        MyAccount::accept_ownership(ctx)
    }

    pub fn renounce_ownership(ctx: Context<MyAccountRenounceOwnership>) -> Result<()> {
        MyAccount::renounce_ownership(ctx)
    }

    pub fn cancel_transfer(ctx: Context<MyAccountCancelTransfer>) -> Result<()> {
        MyAccount::cancel_transfer(ctx)
    }
}
```

## Account Space

When initializing an account that implements `Ownable`, make sure to allocate enough space for the ownership data:
- Ownership struct size: 66 bytes (2 optional Pubkeys: 33 bytes each)
- Add this to your existing account size calculation

Example:
```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 +    // Account discriminator
               66 +    // Ownership struct
               32      // Other account data
    )]
    pub account: Account<'info, MyAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

## Ownership Transfer Process

1. Current owner initiates transfer:
```typescript
await program.methods
  .transferOwnership(newOwnerPubkey)
  .accounts({
    state: statePubkey,
    authority: currentOwner.publicKey,
  })
  .signers([currentOwner])
  .rpc();
```

2. New owner accepts transfer:
```typescript
await program.methods
  .acceptOwnership()
  .accounts({
    state: statePubkey,
    authority: newOwner.publicKey,
  })
  .signers([newOwner])
  .rpc();
```

Either party can cancel the transfer before acceptance:
```typescript
await program.methods
  .cancelTransfer()
  .accounts({
    state: statePubkey,
    authority: ownerOrPendingOwner.publicKey,
  })
  .signers([ownerOrPendingOwner])
  .rpc();
```

## Error Handling

The library provides the following error types:
- `NotOwner`: Operation requires current owner
- `CannotTransferToSelf`: Attempted transfer to current owner
- `NoPendingTransfer`: No transfer in progress
- `NotPendingOwner`: Caller is not the pending owner
- `NotOwnerOrPendingOwner`: Caller must be owner or pending owner
- `InvalidAddress`: Cannot transfer to zero address

## Running Tests

The library includes comprehensive tests that demonstrate functionality and edge cases. To run the tests:

1. Navigate to the test-program directory:
```bash
cd test-program
```

2. Run the Anchor tests:
```bash
anchor test
```

## Security Considerations

- Be cautious with `renounce_ownership` as it permanently removes owner privileges
- Ensure proper access control in your program's other instructions by checking ownership
- Consider implementing a time delay for ownership transfers in security-critical applications
- Always implement the entire set of required instruction handlers for each account that derives ownership
