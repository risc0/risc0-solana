import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TestProgram } from "../target/types/test_program";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { expect } from "chai";

describe("Anchor Ownable Tests", () => {
  // Test context to hold common state
  type TestContext = {
    provider: anchor.AnchorProvider;
    program: Program<TestProgram>;
    authority: Keypair;
    newOwner: Keypair;
    randomPerson: Keypair;
    connection: Connection;
  };

  let ctx: TestContext;
  let statePubkey: PublicKey;

  // Helper functions
  async function setupTestContext(): Promise<TestContext> {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    return {
      provider,
      program: anchor.workspace.TestProgram as Program<TestProgram>,
      authority: Keypair.generate(),
      newOwner: Keypair.generate(),
      randomPerson: Keypair.generate(),
      connection: provider.connection,
    };
  }

  async function airdropTo(pubkey: PublicKey): Promise<void> {
    const signature = await ctx.connection.requestAirdrop(pubkey, 1000000000);
    const latestBlockhash = await ctx.connection.getLatestBlockhash();

    await ctx.connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
  }

  async function initializeState(
    owner: Keypair = ctx.authority
  ): Promise<PublicKey> {
    const stateKeypair = Keypair.generate();
    await ctx.program.methods
      .initialize()
      .accounts({
        state: stateKeypair.publicKey,
        authority: owner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([owner, stateKeypair])
      .rpc();

    return stateKeypair.publicKey;
  }

  async function transferOwnership(
    state: PublicKey,
    newOwner: PublicKey,
    authority: Keypair
  ): Promise<void> {
    await ctx.program.methods
      .transferOwnership(newOwner)
      .accounts({
        state,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();
  }

  async function acceptOwnership(
    state: PublicKey,
    authority: Keypair
  ): Promise<void> {
    await ctx.program.methods
      .acceptOwnership()
      .accounts({
        state,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();
  }

  async function cancelTransfer(
    state: PublicKey,
    authority: Keypair
  ): Promise<void> {
    await ctx.program.methods
      .cancelTransfer()
      .accounts({
        state,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();
  }

  async function renounceOwnership(
    state: PublicKey,
    authority: Keypair
  ): Promise<void> {
    await ctx.program.methods
      .renounceOwnership()
      .accounts({
        state,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();
  }

  async function getState(state: PublicKey) {
    return await ctx.program.account.testState.fetch(state);
  }

  async function expectError(
    promise: Promise<any>,
    errorMessage: string
  ): Promise<void> {
    try {
      await promise;
      expect.fail("should have failed");
    } catch (e) {
      expect(e.toString()).to.include(errorMessage);
    }
  }

  before(async () => {
    ctx = await setupTestContext();
    await airdropTo(ctx.authority.publicKey);
  });

  beforeEach(async () => {
    statePubkey = await initializeState();
  });

  describe("Initialization", () => {
    it("Initializes program state correctly", async () => {
      const state = await getState(statePubkey);
      expect(state.ownership.owner.toString()).to.equal(
        ctx.authority.publicKey.toString()
      );
      expect(state.ownership.pendingOwner).to.be.null;
    });
  });

  describe("Ownership Transfer", () => {
    it("Prevents non-owner from transferring ownership", async () => {
      await expectError(
        transferOwnership(statePubkey, ctx.newOwner.publicKey, ctx.newOwner),
        "NotOwner"
      );
    });

    it("Allows owner to transfer ownership", async () => {
      await transferOwnership(
        statePubkey,
        ctx.newOwner.publicKey,
        ctx.authority
      );
      const state = await getState(statePubkey);
      expect(state.ownership.pendingOwner.toString()).to.equal(
        ctx.newOwner.publicKey.toString()
      );
    });

    it("Prevents transfer to zero address", async () => {
      await expectError(
        transferOwnership(
          statePubkey,
          anchor.web3.PublicKey.default,
          ctx.authority
        ),
        "InvalidAddress"
      );
    });

    it("Prevents transfer to same address", async () => {
      await expectError(
        transferOwnership(statePubkey, ctx.authority.publicKey, ctx.authority),
        "CannotTransferToSelf"
      );
    });

    it("Owner retains control during pending transfer", async () => {
      await transferOwnership(
        statePubkey,
        ctx.newOwner.publicKey,
        ctx.authority
      );
      await cancelTransfer(statePubkey, ctx.authority);

      const state = await getState(statePubkey);
      expect(state.ownership.pendingOwner).to.be.null;
    });
  });

  describe("Ownership Acceptance", () => {
    beforeEach(async () => {
      await airdropTo(ctx.newOwner.publicKey);
      await airdropTo(ctx.randomPerson.publicKey);
    });

    it("Prevents owner from accepting ownership", async () => {
      await transferOwnership(
        statePubkey,
        ctx.newOwner.publicKey,
        ctx.authority
      );
      await expectError(
        acceptOwnership(statePubkey, ctx.randomPerson),
        "NotPendingOwner"
      );
    });

    it("Allows pending owner to accept ownership", async () => {
      await transferOwnership(
        statePubkey,
        ctx.newOwner.publicKey,
        ctx.authority
      );
      await acceptOwnership(statePubkey, ctx.newOwner);

      const state = await getState(statePubkey);
      expect(state.ownership.owner.toString()).to.equal(
        ctx.newOwner.publicKey.toString()
      );
      expect(state.ownership.pendingOwner).to.be.null;
    });

    it("Prevents accepting non-existent transfer", async () => {
      await expectError(
        acceptOwnership(statePubkey, ctx.newOwner),
        "NoPendingTransfer"
      );
    });
  });

  describe("Transfer Cancellation", () => {
    it("Allows owner to cancel transfer", async () => {
      await transferOwnership(
        statePubkey,
        ctx.newOwner.publicKey,
        ctx.authority
      );
      await cancelTransfer(statePubkey, ctx.authority);

      const state = await getState(statePubkey);
      expect(state.ownership.pendingOwner).to.be.null;
    });

    it("Allows pending owner to cancel transfer", async () => {
      await transferOwnership(
        statePubkey,
        ctx.newOwner.publicKey,
        ctx.authority
      );
      await cancelTransfer(statePubkey, ctx.newOwner);

      const state = await getState(statePubkey);
      expect(state.ownership.pendingOwner).to.be.null;
    });

    it("Prevents cancelling non-existent transfer", async () => {
      await expectError(
        cancelTransfer(statePubkey, ctx.authority),
        "NoPendingTransfer"
      );
    });
  });

  describe("Ownership Renouncement", () => {
    it("Allows owner to renounce ownership", async () => {
      await renounceOwnership(statePubkey, ctx.authority);

      const state = await getState(statePubkey);
      expect(state.ownership.owner).to.be.null;
      expect(state.ownership.pendingOwner).to.be.null;
    });

    it("Prevents operations after ownership renouncement", async () => {
      await renounceOwnership(statePubkey, ctx.authority);

      await expectError(
        transferOwnership(statePubkey, ctx.newOwner.publicKey, ctx.authority),
        "NotOwner"
      );

      await expectError(
        acceptOwnership(statePubkey, ctx.newOwner),
        "NoPendingTransfer"
      );
    });
  });
});
