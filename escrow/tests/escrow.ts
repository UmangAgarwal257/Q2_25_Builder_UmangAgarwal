import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction
} from "@solana/web3.js";
import { BN } from "bn.js";
import { Escrow } from "../target/types/escrow";

const secretKey = Uint8Array.from(require("../keys/turbin3.json"));
const keypair = Keypair.fromSecretKey(secretKey);

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const connection = anchor.getProvider().connection;

  const program = anchor.workspace.Escrow as Program<Escrow>;

  let mintA;
  let mintB;

  it("Is initialized!", async () => {
    mintA = await createMint(connection, keypair, keypair.publicKey, null, 6);
    mintB = await createMint(connection, keypair, keypair.publicKey, null, 6);

    const ataA = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mintA,
      keypair.publicKey
    );

    const ataB = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mintB,
      keypair.publicKey
    );

    await mintTo(
      connection,
      keypair,
      mintA,
      ataA.address,
      keypair.publicKey,
      10_000_000
    );

    await mintTo(
      connection,
      keypair,
      mintB,
      ataB.address,
      keypair.publicKey,
      10_000_000
    );

    const balanceA = await connection.getTokenAccountBalance(ataA.address);
    const balanceB = await connection.getTokenAccountBalance(ataB.address);

    console.log("Initial balance A => ", balanceA.value.uiAmount);
    console.log("Initial balance B => ", balanceB.value.uiAmount);

    const seed = new BN(1);
    const receive = new BN(1_000_000);

    const [escrow] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        keypair.publicKey.toBuffer(),
        Buffer.from(seed.toArray("le", 8))
      ],
      program.programId
    );

    const vault = await getAssociatedTokenAddress(mintA, escrow, true);

    const makeIx = await program.methods
      .make(seed, receive)
      .accounts({
        maker: keypair.publicKey,
        mintA: mintA,
        mintB: mintB,
        // @ts-ignore
        makerAtaA: ataA.address,
        escrow,
        vaultA: vault,
        associatedTokenProgam: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systeProgram: SYSTEM_PROGRAM_ID
      })
      .instruction();

    // const depositAmount = new BN(1_000_000);

    // const makeIx = await program.methods
    //   .make(depositAmount)
    //   .accounts({
    //     maker: keypair.publicKey,
    //     mintA: mintA,
    //     mintB: mintB,
    //     // @ts-ignore
    //     makerAtaA: ataA.address,
    //     escrow,
    //     vaultA: vault,
    //     associatedTokenProgam: ASSOCIATED_TOKEN_PROGRAM_ID,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //     systeProgram: SYSTEM_PROGRAM_ID
    //   })
    //   .instruction();

    const tx = new Transaction().add(makeIx);
    tx.feePayer = keypair.publicKey;

    const txHash = await sendAndConfirmTransaction(connection, tx, [keypair], {
      skipPreflight: true
    });

    console.log("Your transaction signature", txHash);

    const vaultBalanceA = await connection.getTokenAccountBalance(vault);
    // const balanceB = await connection.getTokenAccountBalance(ataB.address);

    console.log("Vault balance A => ", vaultBalanceA.value.uiAmount);
    // console.log("Initial balance B => ", balanceB);

    const balanceAafterDeposit = await connection.getTokenAccountBalance(
      ataA.address
    );
    // const balanceB = await connection.getTokenAccountBalance(ataB.address);

    console.log(
      "balance A after deposit => ",
      balanceAafterDeposit.value.uiAmount
    );
    // console.log("balance B => ", balanceB);
  });

  it("Refunded!", async () => {
    const ataA = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mintA,
      keypair.publicKey
    );

    const ataB = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mintB,
      keypair.publicKey
    );

    const seed = new BN(1);

    const [escrow] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        keypair.publicKey.toBuffer(),
        Buffer.from(seed.toArray("le", 8))
      ],
      program.programId
    );

    const vault = await getAssociatedTokenAddress(mintA, escrow, true);

    const refundIx = await program.methods
      .refund(seed)
      .accounts({
        maker: keypair.publicKey,
        mintA: mintA,
        mintB: mintB,
        // @ts-ignore
        makerAtaA: ataA.address,
        escrow,
        vaultA: vault,
        associatedTokenProgam: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systeProgram: SYSTEM_PROGRAM_ID
      })
      .instruction();

    const tx = new Transaction().add(refundIx);
    tx.feePayer = keypair.publicKey;

    const txHash = await sendAndConfirmTransaction(connection, tx, [keypair], {
      skipPreflight: true
    });

    console.log("Your transaction signature", txHash);

    const balanceA = await connection.getTokenAccountBalance(ataA.address);
    // const balanceB = await connection.getTokenAccountBalance(ataB.address);

    console.log("balance A after refund => ", balanceA.value.uiAmount);
    // console.log("balance B => ", balanceB);
  });
});