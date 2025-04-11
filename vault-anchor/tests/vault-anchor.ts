import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorVault } from "../target/types/anchor_vault";
import { assert } from "chai";
import {
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";

describe("anchor-vault", () => {
  // Configure the client to use the local cluster.
  // anchor.setProvider(anchor.AnchorProvider.env()); // Use this if running against devnet/mainnet with env vars configured
  const provider = anchor.AnchorProvider.local(); // Use local cluster provider for testing
  anchor.setProvider(provider);

  // --- Get the program instance ---
  // Corrected name to match IDL type 'AnchorVault'
  const program = anchor.workspace.AnchorVault as Program<AnchorVault>;
  const programId = program.programId;

  // --- Define reusable variables ---
  const payer = provider.wallet as anchor.Wallet; // Wallet paying for transactions & owning the vault
  console.log(`Payer/User: ${payer.publicKey.toBase58()}`);

  // --- PDA derivations ---
  // Function to find the Vault State PDA
  const findVaultStatePDA = (user: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("state"), user.toBuffer()],
      programId
    );
  };

  // Function to find the Vault PDA (System Account holding SOL)
  const findVaultPDA = (user: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.toBuffer()],
      programId
    );
  };

  // Derive PDAs for the main test user (payer)
  const [vaultStatePDA, stateBump] = findVaultStatePDA(payer.publicKey);
  const [vaultPDA, vaultBump] = findVaultPDA(payer.publicKey); // This bump isn't directly used in calls but good to have

  console.log(`Vault State PDA: ${vaultStatePDA.toBase58()}`);
  console.log(`Vault PDA (SOL Holder): ${vaultPDA.toBase58()}`);

  // --- Test Initialization ---
  it("Initializes the vault state and derives vault PDA", async () => {
    try {
      const txSignature = await program.methods
        .initialize()
        .accounts({
          user: payer.publicKey,
          vaultState: vaultStatePDA,
          vault: vaultPDA, // The vault PDA itself is just derived, not initialized here
          systemProgram: SystemProgram.programId,
        })
        .signers([payer.payer]) // Payer signs
        .rpc();

      console.log("Initialize transaction signature", txSignature);

      // --- Verification ---
      // 1. Check if VaultState account was created and bumps stored correctly
      const vaultStateAccount = await program.account.vaultState.fetch(
        vaultStatePDA
      );
      assert.ok(
        vaultStateAccount.stateBump === stateBump,
        `Expected stateBump ${stateBump}, got ${vaultStateAccount.stateBump}`
      );
      // Note: The vault_bump stored in state *should* match the one derived here
      assert.ok(
        vaultStateAccount.vaultBump === vaultBump,
        `Expected vaultBump ${vaultBump}, got ${vaultStateAccount.vaultBump}`
      );

      // 2. Check that the vault PDA (system account) exists and has 0 balance initially
      // (it wasn't initialized with funds, just derived)
      const vaultAccountInfo = await provider.connection.getAccountInfo(
        vaultPDA
      );
      // It might not exist if rent wasn't paid, or have 0 lamports.
      // Let's check its balance is 0. An error might occur if it truly doesn't exist.
      // In practice, it will likely exist with 0 lamports after derivation in the instruction.
      const vaultBalance = await provider.connection.getBalance(vaultPDA);
      assert.strictEqual(vaultBalance, 0, "Vault PDA should have 0 lamports initially");

    } catch (error) {
      console.error("Initialization failed:", error);
      throw error;
    }
  });

  // --- Test Initialization Failure (Already Initialized) ---
  it("Should fail to initialize an already initialized vault", async () => {
    try {
      await program.methods
        .initialize()
        .accounts({
          user: payer.publicKey,
          vaultState: vaultStatePDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer.payer])
        .rpc();
      assert.fail("Initialization should have failed but succeeded.");
    } catch (error) {
      // We expect an error because the account is already created ('init' constraint)
      // The specific error might vary slightly depending on Solana/Anchor version
      // console.error("Expected initialization failure:", error); // Log error for debugging
      assert.include(
        error.logs.join(" "), // Check logs for indication of account already in use
        "already in use",
        "Error message should indicate account already exists"
      );
      // Or check error code if available and consistent
    }
  });


  // --- Test Deposit ---
  it("Deposits SOL into the vault", async () => {
    const depositAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // Deposit 1 SOL

    // Get balances before
    const userBalanceBefore = await provider.connection.getBalance(payer.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPDA);

    const txSignature = await program.methods
      .deposit(depositAmount)
      .accounts({
        user: payer.publicKey,
        vaultState: vaultStatePDA,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer.payer]) // Payer signs the transfer FROM their account
      .rpc();

    console.log("Deposit transaction signature", txSignature);

    // Fetch transaction details to estimate fee (optional, but good for precise checks)
    // const tx = await provider.connection.getTransaction(txSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    // const fee = tx?.meta?.fee ?? 5000; // Default fee estimate if tx details not available

    // Get balances after
    const userBalanceAfter = await provider.connection.getBalance(payer.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);

    // --- Verification ---
    // 1. Vault balance should increase by exactly the deposit amount
    assert.strictEqual(
      vaultBalanceAfter,
      vaultBalanceBefore + depositAmount.toNumber(),
      "Vault balance did not increase correctly"
    );

    // 2. User balance should decrease by deposit amount + transaction fee
    // Note: This check is less precise due to fluctuating fees.
    // Checking the vault balance change is usually more reliable.
    // assert.isAtMost(userBalanceAfter, userBalanceBefore - depositAmount.toNumber(), "User balance did not decrease sufficiently");
    console.log(`User balance change approx: ${(userBalanceBefore - userBalanceAfter)/LAMPORTS_PER_SOL} SOL`);
    console.log(`Vault balance change: ${ (vaultBalanceAfter - vaultBalanceBefore)/LAMPORTS_PER_SOL } SOL`);

  });

  // --- Test Withdraw ---
  it("Withdraws SOL from the vault", async () => {
    // Assuming 1 SOL was deposited in the previous test
    const withdrawAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // Withdraw 0.5 SOL

    // Get balances before
    const userBalanceBefore = await provider.connection.getBalance(payer.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPDA);

    assert.isAbove(vaultBalanceBefore, 0, "Vault must have balance to withdraw");
    assert.isAtLeast(vaultBalanceBefore, withdrawAmount.toNumber(), "Cannot withdraw more than balance");

    const txSignature = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        user: payer.publicKey,
        vaultState: vaultStatePDA,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer.payer]) // User must sign to authorize withdrawal to their account
      .rpc();

    console.log("Withdraw transaction signature", txSignature);

    // Get balances after
    const userBalanceAfter = await provider.connection.getBalance(payer.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);

     // --- Verification ---
    // 1. Vault balance should decrease by exactly the withdraw amount
    assert.strictEqual(
        vaultBalanceAfter,
        vaultBalanceBefore - withdrawAmount.toNumber(),
        "Vault balance did not decrease correctly"
      );

    // 2. User balance should increase (less fees)
    // assert.isAbove(userBalanceAfter, userBalanceBefore - 5000, "User balance did not increase (accounting for fee)");
     console.log(`User balance change approx: ${(userBalanceAfter - userBalanceBefore)/LAMPORTS_PER_SOL} SOL`);
     console.log(`Vault balance change: ${ (vaultBalanceAfter - vaultBalanceBefore)/LAMPORTS_PER_SOL } SOL`);
  });

  // --- Test Withdraw Failure (Insufficient Funds) ---
  it("Should fail to withdraw more SOL than deposited", async () => {
    const vaultBalance = await provider.connection.getBalance(vaultPDA);
    const withdrawAmount = new anchor.BN(vaultBalance + 1 * LAMPORTS_PER_SOL); // Try to withdraw more than available

    try {
      await program.methods
        .withdraw(withdrawAmount)
        .accounts({
          user: payer.publicKey,
          vaultState: vaultStatePDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer.payer])
        .rpc();
      assert.fail("Withdrawal should have failed but succeeded.");
    } catch (error) {
      // We expect a transfer error from the System Program via CPI
      // console.error("Expected withdrawal failure:", error);
      assert.include(
        error.toString(), // Error might be complex, check string representation
        "Transfer: insufficient lamports", // This is a common error message for this case
        "Error message should indicate insufficient funds"
      );
      // Or check logs:
      // assert.include(error.logs.join(" "), "insufficient lamports");
    }

     // Verify balance didn't change
     const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);
     assert.strictEqual(vaultBalanceAfter, vaultBalance, "Vault balance should not change on failed withdrawal");
  });

  // --- Test Auth Failure (Withdraw by wrong user) ---
   it("Should fail to withdraw from vault by wrong user", async () => {
       const maliciousUser = anchor.web3.Keypair.generate();
       console.log(`Malicious User: ${maliciousUser.publicKey.toBase58()}`);

       // Airdrop some SOL to the malicious user for fees
       await provider.connection.requestAirdrop(
           maliciousUser.publicKey,
           1 * LAMPORTS_PER_SOL
       );
       // Await confirmation (important!)
       await new Promise(resolve => setTimeout(resolve, 1000)); // Simple delay, consider confirming tx
       const maliciousBalance = await provider.connection.getBalance(maliciousUser.publicKey);
       assert.isAbove(maliciousBalance, 0);


       const vaultBalance = await provider.connection.getBalance(vaultPDA);
       const withdrawAmount = new anchor.BN(vaultBalance / 2); // Try to withdraw half

       // Derive the vault PDAs *as if* they belonged to the malicious user
       const [maliciousVaultStatePDA, ] = findVaultStatePDA(maliciousUser.publicKey);
       const [maliciousVaultPDA, ] = findVaultPDA(maliciousUser.publicKey);


       try {
           // Malicious user tries to withdraw from the *original* user's vault PDA
           await program.methods
               .withdraw(withdrawAmount)
               .accounts({
                   user: maliciousUser.publicKey, // The malicious user is the signer/recipient
                   vaultState: vaultStatePDA, // TARGETING ORIGINAL USER'S STATE PDA
                   vault: vaultPDA,          // TARGETING ORIGINAL USER'S VAULT PDA
                   systemProgram: SystemProgram.programId,
               })
               .signers([maliciousUser]) // Malicious user signs
               .rpc();
           assert.fail("Withdrawal by wrong user should have failed.");
       } catch (error) {
           // Expecting constraint violation because seeds ('user' key in seeds) won't match signer
           // console.error("Expected auth failure:", error);
           // Anchor typically throws detailed errors for constraint failures
           assert.include(error.message, "ConstraintSeeds", "Error should be a seeds constraint violation");
           // Or check error code: assert.equal(error.error.errorCode.code, "ConstraintSeeds");
       }

       // Verify original vault balance unchanged
        const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);
        assert.strictEqual(vaultBalanceAfter, vaultBalance, "Vault balance should not change on failed auth withdrawal");

   });


  // --- Test Close ---
  it("Closes the vault and returns all SOL", async () => {
    // Get balances before closing
    const userBalanceBefore = await provider.connection.getBalance(payer.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPDA);
    assert.isAbove(vaultBalanceBefore, 0, "Vault should have some balance to close");

    const txSignature = await program.methods
      .close()
      .accounts({
        user: payer.publicKey,
        vaultState: vaultStatePDA, // State account will be closed
        vault: vaultPDA,         // Vault PDA will be emptied
        systemProgram: SystemProgram.programId,
      })
      .signers([payer.payer]) // User must sign to close their vault
      .rpc();

    console.log("Close transaction signature", txSignature);

    // Get user balance after
    const userBalanceAfter = await provider.connection.getBalance(payer.publicKey);

     // --- Verification ---
    // 1. Vault State account should be closed (null)
    const vaultStateInfo = await provider.connection.getAccountInfo(vaultStatePDA);
    assert.isNull(vaultStateInfo, "Vault State PDA should be closed");

    // 2. Vault PDA should have 0 balance (all SOL returned)
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPDA);
    assert.strictEqual(vaultBalanceAfter, 0, "Vault PDA should be empty after close");

    // 3. User balance should increase by vault balance (less fees)
    // assert.isAbove(userBalanceAfter, userBalanceBefore + vaultBalanceBefore - 10000, "User balance did not increase correctly after close");
    console.log(`User balance change approx: ${(userBalanceAfter - userBalanceBefore)/LAMPORTS_PER_SOL} SOL`);
    console.log(`Vault balance before close: ${vaultBalanceBefore/LAMPORTS_PER_SOL} SOL`);


  });

   // --- Test Close Failure (Already Closed) ---
  it("Should fail to close an already closed vault", async () => {
       // Vault was closed in the previous test
       try {
           await program.methods
           .close()
           .accounts({
               user: payer.publicKey,
               vaultState: vaultStatePDA, // This account no longer exists
               vault: vaultPDA,
               systemProgram: SystemProgram.programId,
           })
           .signers([payer.payer])
           .rpc();
           assert.fail("Closing an already closed vault should have failed.");
       } catch (error) {
           // Expecting account not found or constraint violation
           // console.error("Expected close failure:", error);
           // The error might be about the vaultState account not existing or failing constraints
            assert.include(error.message, "AccountNotInitialized", "Error message should indicate account not found or constraint issue");
            // Or: assert.include(error.message, "ConstraintSeeds"); // If it checks seeds before realizing it's closed
       }
  });

});