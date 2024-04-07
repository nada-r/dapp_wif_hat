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

export async function acceptBet(discordId, betId) {
    console.log("accepting bet", bet);

    let bet = bets.find((bet) => bet.id === betId);
    let wallet = wallets.find((wallet) => wallet.discordId === discordId);
}

export async function closeBet(bet) {
    // const betAddress = bet.address;
    const program = await connection.getAccountInfo(
        new PublicKey("SOLBET_PROGRAM_ID")
    );
    const betAccount = ""; //
    const userA = data.slice(0, 8).toString();
    const userB = data.slice(8, 16).toString();
    const created = data.slice(16, 24).toString();
    const status = bet.status;

    let match = null;
    let winner = null;
    let cancel = false;

    const puuiduserA = await axios.get(
        "https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${userA}?api_key=" +
            apiKey
    );
    const puuiduserB = await axios.get(
        "https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${userB}?api_key=" +
            apiKey
    );
    const userA_MatchListFromCreated = await axios.get(
        `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${userA}/ids?ids?startTime=${
            bet.created
        }&endTime=${
            bet.created + 24 * 60 * 60 * 1000
        }&start=0&count=100&api_key=${apiKey}`
    );

    // check each match to see if userB is in it
    for (let m of userA_MatchListFromCreated.data) {
        const matchData = await axios.get(
            `https://americas.api.riotgames.com/lol/match/v5/matches/${m}?api_key=${apiKey}`
        );
        const participants = matchData.data.info.participants;
        for (let participant of participants) {
            if (participant.puuid === userB) {
                match = matchData;
                break;
            }
        }
    }

    if (match) {
        if (bet.status === "confirmed") {
            // check that it has not been accepted after the beginning of the match (refund both), then
            let matchStartTime = match.info.gameStartTimestamp;
            let acceptedTime = bet.accepted;

            if (acceptedTime > matchStartTime) {
                // refund both
            } else {
                // check winner
                let userAIndex = match.info.participants.findIndex(
                    (participant) => participant.puuid === puuiduserA
                );
                let userBIndex = match.info.participants.findIndex(
                    (participant) => participant.puuid === puuiduserB
                );
                let userAWon = match.info.participants[userAIndex].win;
                let userBWon = match.info.participants[userBIndex].win;

                if (userAWon && !userBWon) {
                    // send funds to maker
                } else if (userBWon && !userAWon) {
                    // send funds to challenger
                } else {
                    // refund both
                    return "Invalid match result. Refunding both.";
                }
            }
        } else if (
            bet.status === "confirmed" &&
            new Date().getTime() - bet.accepted > 24 * 60 * 60 * 1000
        ) {
            // refund both
        } else if (bet.status === "open") {
            // refund maker & cancel bet
        } else {
            return "Bet is still open. You will be able to close it if the match has no result after 24 hours.";
        }
    }
}

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

export async function fundWallet(discordId, amount, currency) {
    let wallet = wallets.find((wallet) => wallet.discordId === discordId);
    if (!wallet) {
        await createWallet(discordId);
        wallet = wallets.find((wallet) => wallet.discordId === discordId);
    }
    let address = wallet.address;
    console.log("Funding wallet", address);

    const reference = new Keypair().publicKey;
    const label = `SolBet fund wallet - ${discordId}`;
    const message = `Fund your account with ${amount} ${currency}`;
    const splToken = new PublicKey(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    );
    // const memo = 'JC#4098';

    let url = encodeURL({
        recipient: new PublicKey(address),
        amount: new BigNumber(amount).times(10 ** 9),
        reference,
        label,
        message,
        splToken,
        // memo,
    });

    return url;
}

async function refundBoth(bet) {
    console.log("Refunding both");
}

async function refundMaker(bet) {
    console.log("Refunding maker");
}

async function claimWin(bet) {
    console.log("Claiming win");
}
// async function main() {
//     await createWallet("test");
//     console.log(wallets);
// }

// main();
