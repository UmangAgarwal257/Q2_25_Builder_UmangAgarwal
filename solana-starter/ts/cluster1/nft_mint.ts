import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createSignerFromKeypair, signerIdentity, generateSigner, percentAmount } from "@metaplex-foundation/umi"
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";

import wallet from "./wallet/wba-wallet.json"
import base58 from "bs58";

const RPC_ENDPOINT = "https://api.devnet.solana.com";
const umi = createUmi(RPC_ENDPOINT);

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
umi.use(mplTokenMetadata())

const mint = generateSigner(umi);

(async () => {
    let tx = await createNft(umi, { mint, name: "IPL NFT Collection", symbol: "CSK", uri: "https://devnet.irys.xyz/Eo4GdN1magNuxnXD2jkJjbSgJgLvHbts1oPcvMaBzfGC", sellerFeeBasisPoints: percentAmount(4) })
    let result = await tx.sendAndConfirm(umi);
    const signature = base58.encode(result.signature);

    console.log(`Succesfully Minted! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`)

    console.log("Mint Address: ", mint.publicKey);
})();

// mint address = HVRbA1upEN22TiiM87kDLwKV6gkjJcS55vAEiuH26ZFM
//                7GpEnYoM9U6TiPaFK7JEubaVVRW1ogtm9Q45sMVoH2Lw