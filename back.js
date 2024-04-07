import BigNumber from "bignumber.js";
import bs58 from "bs58";
import { Wallet } from "@project-serum/anchor";
import fs, { stat } from "fs";
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { findReference } from "@solana/pay";
import {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
    Connection,
    clusterApiUrl,
    Keypair,
    PublicKey,
    VersionedTransaction,
    Transaction,
    SystemProgram,
    ComputeBudgetProgram,
    TransactionMessage,
} from "@solana/web3.js";
const BET_PROGRAM_ID = new PublicKey(
    "8ftb8B4NeJd2yfguVZo4BqUuBRhuMGpqHhQZ3StK8DH8"
);
const program = new Program(idl, BET_PROGRAM_ID, provider);

let data = JSON.parse(fs.readFileSync("./data.json"));
let wallets = data.wallets;
let bets = data.bets;
const apiKey = process.env.RIOTS_API_KEY;

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

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
        created: timestamp,
        id: id,
    };

    if (challenger) {
        bet.challenger = challenger;
    }

    const associatedTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        new PublicKey(wallet.address)
    );

    const destinationExists = !!(await connection.getAccountInfo(
        associatedTokenAccount
    ));

    if (!destinationExists) {
        var transaction = new Transaction();

        transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({
                units: 1000000,
            })
        );

        transaction.add(
            ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 5000,
            })
        );

        transaction.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                associatedTokenAccount,
                payer.publicKey,
                tokenMint
            )
        );

        // add blockhash
        const blockhashResponse = await connection.getLatestBlockhashAndContext(
            "finalized"
        );
        transaction.recentBlockhash = blockhashResponse.value.blockhash;
        const lastValidHeight = blockhashResponse.value.lastValidBlockHeight;
        transaction.lastValidBlockHeight = lastValidHeight;
        // sign the transaction
        transaction.sign(w.payer);

        // Execute the transaction
        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            maxRetries: 0,
        });
    }

    const mint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

    bets.push(bet);
    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    await proposeBet(
        amount,
        new PublicKey(wallet.address),
        associatedTokenAccount,
        mint,
        provider,
        id
    );

    return { success: true, id: id };
}

export async function acceptBet(discordId, betId) {
    let bet = bets.find((b) => b.id == betId);
    if (!bet) {
        return { success: false, msg: `Bet with id ${betId} not found.` };
    }
    if (bet.hasOwnProperty("challenger")) {
        if (bet.challenger !== discordId) {
            return { success: false, msg: "This bet is not for you." };
        }
    }

    let wallet = wallets.find((wallet) => wallet.discordId === discordId);

    bet.status = "confirmed";
    bet.accepted = new Date().getTime();
    bet.challenger = discordId;

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    return { success: true, msg: "Bet accepted." };
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

export async function withdraw(destinationAddress, amount, discordId, mint) {
    let wallet = wallets.find((wallet) => wallet.discordId === discordId);
    let address = wallet.address;
    let payer = new Wallet(
        Keypair.fromSecretKey(Uint8Array.from(bs58.decode(wallet.privateKey)))
    );

    if (mint === "SOL") {
        const amountInLamports = amount * Math.pow(10, 9);

        // construct the transfer instruction
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: new PublicKey(destinationAddress),
            lamports: amountInLamports,
        });

        let recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const message = new TransactionMessage({
            payerKey: new PublicKey(address),
            recentBlockhash,
            instructions: [transferInstruction],
        }).compileToV0Message();

        // create a versioned transaction using the message
        const tx = new VersionedTransaction(message);

        tx.sign([payer.payer]);

        // actually send the transaction
        const txSig = await connection.sendTransaction(tx);

        return { success: true, msg: `Transaction sent: ${txSig}` };
    } else if (mint === "USDC") {
        const mint = new PublicKey(
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        );

        const associatedTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            new PublicKey(destinationAddress)
        );

        const senderTokenAccount = await getAssociatedTokenAddress(
            tokenMint,
            new PublicKey(address)
        );

        const destinationExists = !!(await connection.getAccountInfo(
            associatedTokenAccount
        ));

        var transaction = new Transaction();

        transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({
                units: 1000000,
            })
        );

        transaction.add(
            ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 5000,
            })
        );

        if (!destinationExists) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    payer.publicKey,
                    associatedTokenAccount,
                    payer.publicKey,
                    tokenMint
                )
            );
        }

        tx.add(
            createTransferInstruction(
                senderTokenAccount,
                associatedTokenAccount,
                payer.publicKey,
                amount * Math.pow(10, 9)
            )
        );

        // add blockhash
        const blockhashResponse = await connection.getLatestBlockhashAndContext(
            "finalized"
        );
        transaction.recentBlockhash = blockhashResponse.value.blockhash;
        const lastValidHeight = blockhashResponse.value.lastValidBlockHeight;
        transaction.lastValidBlockHeight = lastValidHeight;
        // sign the transaction
        transaction.sign(w.payer);

        // Execute the transaction
        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            maxRetries: 0,
        });

        let hashExpired = false;
        let txSuccess = false;
        let message = "";
        while (!hashExpired && !txSuccess) {
            const { value: status } = await connection.getSignatureStatus(txid);

            // Break loop if transaction has succeeded
            if (
                status &&
                (status.confirmationStatus === "processed" ||
                    status.confirmationStatus === "confirmed" ||
                    status.confirmationStatus === "finalized")
            ) {
                txSuccess = true;
                message = `\nSuccessful buy transaction! https://solscan.io/tx/${txid}`;
                break;
            }

            hashExpired = await isBlockhashExpired(lastValidHeight);

            // Break loop if blockhash has expired
            if (hashExpired) {
                throw new Error("Blockhash has expired.");
            }

            // Check again after 2.5 sec
            await sleep(250);
        }

        return { success: txSuccess, msg: message };
    } else {
        console.log("Invalid mint");
    }
}

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

    const splToken = new PublicKey(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    );

    const url = `https://hackathon.botsonblock.com/page?address=${address}&amount=${amount}`;

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

export async function waitFunds(discordId) {
    await wait(5000);
    let wallet = wallets.find((wallet) => wallet.discordId === discordId);
    let address = wallet.address;

    const url = `https://hackathon.botsonblock.com/data/references.json`;

    let references = await axios.get(url);
    let potentialReference = references.data.find((r) => {
        return r.publicKey == address;
    });

    // Convertir les propriétés de l'objet en un tableau
    const properties = Object.values(potentialReference);

    // Accéder à la dernière propriété
    const ref = properties[properties.length - 1];
    console.log("Reference", ref);
    // loop and check for 2 mins if funds have been received
    let received = false;
    let start = new Date().getTime();
    while (!received && new Date().getTime() - start < 120000) {
        let signatureInfo = await findReference(
            connection,
            new PublicKey(ref),
            {
                finality: "confirmed",
            }
        );
        if (signatureInfo) {
            received = true;
        }
        await wait(1000);
    }

    return received;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

import { Program, Provider, BN } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

async function proposeBet(
    amount,
    proposer,
    proposerTokenAccount,
    mint,
    provider,
    id
) {
    const betId = BN.from(id);
    const transaction = new web3.Transaction();

    const rent = await provider.connection.getMinimumBalanceForRentExemption(
        165
    );

    const proposeBetInstruction = program.proposeBet(new BN(amount), {
        accounts: {
            bet: null,
            systemProgram: SystemProgram.programId,
            proposer: proposer.publicKey,
            proposerTokenAccount: proposerTokenAccount.publicKey,
            betTokenAccount: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            splMintAccount: mint.publicKey,
            rent: rent,
        },
        signers: [proposer],
        instructions: [(id = betId)],
    });

    transaction.add(proposeBetInstruction);

    let signature = await web3.sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [proposer]
    );
    console.log("Transaction signature", signature);

    return signature;
}

async function acceptBet(
    betId,
    amount,
    accepter,
    accepterTokenAccount,
    provider
) {
    const transaction = new web3.Transaction();

    const acceptBetInstruction = program.acceptBet(new BN(amount), {
        accounts: {
            bet: null,
            accepter: accepter.publicKey,
            accepterTokenAccount: accepterTokenAccount.publicKey,
            betTokenAccount: await PublicKey.findProgramAddressSync(
                ["bets-token-id", betId.toBuffer()],
                BET_PROGRAM_ID
            ),
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [accepter],
        instructions: [(id = betId)],
    });

    transaction.add(acceptBetInstruction);

    let signature = await web3.sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [accepter]
    );
    console.log("Transaction signature", signature);

    return signature;
}

async function resolveBet(betId, winner, admin, provider) {
    const transaction = new web3.Transaction();

    const resolveBetInstruction = program.resolveBet(winner.publicKey, {
        accounts: {
            bet: null,
        },
        signers: [admin],
        instructions: [(id = betId)],
    });

    transaction.add(resolveBetInstruction);

    let signature = await web3.sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [winner]
    );
    console.log("Transaction signature", signature);

    return signature;
}

async function claim_winnings(betId, claimant, claimantTokenAccount) {
    const transaction = new web3.Transaction();

    const claimWinningsInstruction = program.claimWinnings({
        accounts: {
            bet: null,
            claimant: claimant.publicKey,
            claimantTokenAccount: claimantTokenAccount.publicKey,
            betTokenAccount: await PublicKey.findProgramAddressSync(
                ["bets-token-id", betId.toBuffer()],
                BET_PROGRAM_ID
            ),
            tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [claimer],
        instructions: [(id = betId)],
    });

    transaction.add(claimWinningsInstruction);

    let signature = await web3.sendAndConfirmTransaction(
        provider.connection,
        transaction,
        [claimer]
    );
    console.log("Transaction signature", signature);

    return signature;
}
