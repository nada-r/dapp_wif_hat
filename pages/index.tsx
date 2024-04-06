import React, { useState, useEffect } from "react";
import QRCode from "qrcode.react";
import { useRouter } from "next/router";

export default function Home() {
  const [paymentLink, setPaymentLink] = useState("");
  const [reference, setReference] = useState("");
  const [statusMessage, setStatusMessage] = useState("Initializing payment...");
  const router = useRouter();

  useEffect(() => {
    // Destructuring address and amount from router.query
    let { address, amount } = router.query;

    // Ensure address and amount are treated as strings, even if they are arrays
    address = Array.isArray(address) ? address[0] : address;
    amount = Array.isArray(amount) ? amount[0] : amount;

    // Check if address and amount are provided in the URL
    if (address && amount) {
      generatePaymentLink(address, amount);
    } else {
      setStatusMessage("Missing address or amount parameters.");
    }
  }, [router.query]); // Effect runs when query parameters change

  const generatePaymentLink = async (recipient: string, amount: string) => {
    setStatusMessage("Generating payment link...");
    try {
      const response = await fetch("/api/create-payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient, amount }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      setPaymentLink(data.url);
      setReference(data.reference); // Assuming the backend also returns a reference ID
      setStatusMessage("Payment link generated. Please scan the QR code.");
    } catch (error) {
      console.error("Failed to fetch the payment link:", error);
      setStatusMessage("Failed to generate payment link. Please try again.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      {paymentLink ? (
        <>
          <div style={{ marginTop: "20px" }}>
            <QRCode value={paymentLink} size={256} />
          </div>
          <p>Reference ID: {reference}</p>
        </>
      ) : null}
      <p>{statusMessage}</p>
    </div>
  );
}
