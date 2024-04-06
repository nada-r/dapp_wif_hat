import { Keypair } from "@solana/web3.js";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { encodeURL, createQR } from "@solana/pay";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

let data = JSON.parse(fs.readFileSync("./data.json"));
let wallets = data.wallets;
let bets = data.bets;
const apiKey = process.env.RIOTS_API_KEY;

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

async function createWallet(discordId) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    const privateKey = bs58.encode(keypair.secretKey);

    let wallet = {
        discordId: discordId,
        address: address,
        privateKey: privateKey,
        bets: [],
    };

    console.log(`Wallet successfully created: ${wallet.address}`);

    // save wallet data
    wallets.push(wallet);
    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

export async function placeBet(
    discordId,
    amount,
    currency,
    userA,
    userB,
    challenger
) {
    let wallet = wallets.find((wallet) => wallet.discordId === discordId);
    const id = bets.length;

    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    // const privateKey = bs58.encode(keypair.secretKey);

    // const blockhashResponse = await connection.getLatestBlockhashAndContext(
    //     "finalized"
    // );
    // const block = blockhashResponse.value.blockhash;
    const timestamp = new Date().getTime();

    let bet = {
        choiceA: userA,
        choiceB: userB,
        amount: amount,
        currency: currency,
        status: "open",
        address: address,
        maker: discordId,
        challenger: challenger,
        created: timestamp,
    };

    bets.push(bet);
    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    return id;
}

export async function acceptBet(discordId, bet) {
    console.log("accepting bet", bet);
}

// export async function closeBet(bet) {
//     const betAddress = bet.address;
//     const betAccount = await connection.getAccountInfo(new PublicKey(betAddress));
//     const data = betAccount.data;
//     const userA = data.slice(0, 8).toString();
//     const userB = data.slice(8, 16).toString();
//     const created = data.slice(16, 24).toString();

//     let match = null;
//     let winner = null;
//     let cancel = false;

//     const userA_MatchListFromCreated = await axios.get(`https://api.riotgames.com/lol/match/v5/matches/by-puuid/${userA}/ids?start=0&count=10&api_key=${apiKey}`);

//     // check each match to see if userB is in it
//     for (let match of userA_MatchListFromCreated.data) {
//         const matchData = await axios.get(`https://api.riotgames.com/lol/match/v5/matches/${match}?api_key=${apiKey}`);
//         const participants = matchData.data.info.participants;
//         for (let participant of participants) {
//             if (participant.puuid === userB) {
//                 match = matchData;
//                 break;
//             }
//         }
//     }

//     //
//     if (match) {
//     // check that it has not been accepted after the beginning of the match (refund both), then

//         // check winner
//         if () { // A is winner

//         }
//         else if () { // B is winner

//         } else () {
//             // check if it is expired (more than 24 after accepted) refund both

//             // check is maker is cancelling (not accepted yet) refund maker

//             // check if it is expired (more than 24 after created) refund maker
//         }
//     }
// }

export async function withdraw(destinationAddress, amount, discordId) {}

export async function deposit(amount, discordId, currency) {
    if (currency === "SOL") {
        let wallet = wallets.find((wallet) => wallet.discordId === discordId);
        let address = wallet.address;
        // etc
    } else if (currency === "USDC") {
        let wallet = wallets.find((wallet) => wallet.discordId === discordId);
        let address = wallet.address;
    } else {
        console.log("Invalid currency");
    }
}

async function main() {
    await createWallet("test");
    console.log(wallets);
}

main();
