import Head from "next/head";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [qrCode, setQrCode] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const handleGenerateClick = async () => {
    if (!walletAddress || !amount) {
      alert("Please enter both a wallet address and an amount.");
      return;
    }

    try {
      const paymentUrl = `Your Payment URL Logic Here with ${walletAddress} and ${amount}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(paymentUrl)}&size=200x200`;

      setQrCode(qrCodeUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  // Define the handleVerifyClick function
  const handleVerifyClick = async () => {
    // Your handleVerifyClick logic here
  };

  return (
    <>
      <Head>
        <title>QuickNode Solana Pay Demo</title>
        <meta name="description" content="QuickNode Guide: Solana Pay" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-2xl font-semibold mb-4">Solana Pay Demo</h1>
        {qrCode ? (
          <Image
            src={qrCode}
            alt="QR Code"
            width={200}
            height={200}
            priority
            style={{ margin: "auto" }}
          />
        ) : null}
        <div className="mt-4">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleGenerateClick}>
            Generate Solana Pay Order
          </button>
          {reference ? (
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2"
              onClick={handleVerifyClick}>
              Verify Transaction
            </button>
          ) : null}
        </div>
      </main>
    </>
  );
}
