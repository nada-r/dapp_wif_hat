// Import necessary modules
import { PublicKey } from "@solana/web3.js";
import { encodeURL } from "@solana/pay";
import BigNumber from "bignumber.js";

// Function to generate a payment request link

const createPaymentRequestLink = async (
  recipientAddress: string,
  amount: number,
  memo: string
) => {
  const recipient = new PublicKey(recipientAddress);
  const amountBigNumber = new BigNumber(amount);

  // Create a payment request link
  const url = encodeURL({
    recipient,
    amount: amountBigNumber,
    label: "Your Store Name",
    message: "Thank you for your purchase!",
    memo,
  });

  return url.toString();
};
