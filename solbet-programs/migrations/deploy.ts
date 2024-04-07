const anchor = require("@coral-xyz/anchor");

module.exports = async function (provider) {
  anchor.setProvider(provider);

  const programId = new anchor.web3.PublicKey("YOUR_PROGRAM_ID");

  const payer = anchor.web3.Keypair.fromSecretKey(new Uint8Array([
    // YOUR_PAYER_SECRET_KEY
  ]));

  const program = new anchor.Program(programId, programId, provider);

  await program.rpc.deploy({
    accounts: {
      payer: payer.publicKey,
    },
    instructions: [],
    signers: [payer],
  });

  console.log("Program deployed successfully!");
};
