import { Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import wallet from "./wallet/wba-wallet.json"
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

// Mint address
const mint = new PublicKey("BeBVyignUzJrx9hZeazH2T8ehAD8RXpo7EnrJdqtVSyy");

// Recipient address
const to = new PublicKey("AEb2f8aAyALNz6bheiRxsQA2LAeidJLcXK3gK2BjRZM6");

(async () => {
    try {
        // Get the token account of the fromWallet address, and if it does not exist, create it
        const fromWallet = await getOrCreateAssociatedTokenAccount(
            connection,
            keypair,
            mint,
            keypair.publicKey
        )

        // Get the token account of the toWallet address, and if it does not exist, create it
        const toWallet = await getOrCreateAssociatedTokenAccount(connection,keypair,mint,to)

        // Transfer the new token to the "toTokenAccount" we just created
        const transfer_data = await transfer(
            connection,
            keypair,
            fromWallet.address,
            toWallet.address,
            keypair,
            123
        )
        console.log(transfer_data)
    } catch(e) {
        console.error(`Oops, something went wrong: ${e}`)
    }
})();

// 2fe6zVL3dkSG3vPo4AYuA7HK6cDekFxeeAxoG1WK7Azcza7SzW1gpxJeXmWhXCHL51mtuhA83t1chVQ3EeDCkKuC

//Transfer tokens