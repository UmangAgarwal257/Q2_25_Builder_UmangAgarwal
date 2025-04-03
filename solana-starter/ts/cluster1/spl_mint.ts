import { Keypair, PublicKey, Connection, Commitment } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import wallet from "./wallet/wba-wallet.json"

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

const token_decimals = 1_000_000n;

// Mint address
const mint = new PublicKey("BeBVyignUzJrx9hZeazH2T8ehAD8RXpo7EnrJdqtVSyy");

(async () => {
    try {
        // Create an ATA
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey
        )
        console.log(`Your ata is: ${ata.address.toBase58()}`);
        
        // Mint to ATA
        // const mintTx = ???
        const mintTx = await mintTo(
            connection,
            keypair,
            mint,
            ata.address,
            keypair.publicKey,
            token_decimals * 1_000_000n
        )
        console.log(`Your mint txid: ${mintTx}`);
    } catch(error) {
        console.log(`Oops, something went wrong: ${error}`)
    }
})()

// Your ata is: F2ETzyCntpdwDiTA4MdZgr6vNaFDRGEqpAL36Z2QNXyL
// Your mint txid: 21HH1J5bkKm5q5B6BY5ewjYg7FRciq15jk5AY8YcFoGTrn2L6qe9UyNZdXmRdNV3U54QtYGyDzPaEHDyukUcv9Hw