import type { NextApiRequest, NextApiResponse } from "next";
import { clusterApiUrl, Connection, PublicKey, Keypair } from "@solana/web3.js";
import { encodeURL } from "@solana/pay";
import BigNumber from "bignumber.js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const { recipient, amount } = req.body;

  if (!recipient || !amount) {
    return res.status(400).json({ error: "Recipient and amount are required" });
  }

  try {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const reference = new Keypair().publicKey;

    const bigAmount = new BigNumber(amount);
    const recipientPublicKey = new PublicKey(recipient);

    const url = encodeURL({
      recipient: recipientPublicKey,
      amount: bigAmount,
      reference,
      label: "SolBet",
      message: "Yet another way to remove liquidity from your friends.",
    });

    return res.status(200).json({ url, reference: reference.toString() });
  } catch (error) {
    console.error("Error creating payment link:", error);
    return res.status(500).json({ error: "Failed to create payment link" });
  }
}
