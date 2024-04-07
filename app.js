import { config } from "dotenv";
config();
import express from "express";
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
} from "discord-interactions";
import {
    VerifyDiscordRequest,
    getRandomEmoji,
    DiscordRequest,
} from "./utils.js";
import { getShuffledOptions, getResult } from "./game.js";
import { acceptBet, placeBet, fundWallet, withdraw, send } from "./back.js";
import multer from "multer";

console.log(`Hello ${process.env.HELLO}`);

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

const activeGames = {};

app.post("/interactions", async function (req, res) {
    const { type, id, data } = req.body;

    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        if (name === "test") {
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "hello world " + getRandomEmoji(),
                },
            });
        }

        if (name === "fundwallet" && id) {
            const userId = req.body.member.user.id;

            // User's object choice
            const amount = parseFloat(req.body.data.options[0].value);
            const currency = req.body.data.options[1].value;

            const url = await fundWallet(userId, amount, currency);

            res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content:
                        "Click the link and the QR code with your Solana wallet to fund your account",
                    components: [
                        {
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    label: "Fund Wallet",
                                    style: ButtonStyleTypes.LINK,
                                    url: url,
                                },
                            ],
                        },
                    ],
                },
            });

            // const recieved = await waitFunds(userId);
            // if (recieved) {
            //     axios.post(
            //         `https://discord.com/api/v8/interactions/${req.body.id}/${req.body.token}/callback`,
            //         {
            //             type: 4,
            //             data: {
            //                 content: "Funds received!",
            //             },
            //         }
            //     );
            // } else {
            //     axios.post(
            //         `https://discord.com/api/v8/interactions/${req.body.id}/${req.body.token}/callback`,
            //         {
            //             type: 4,
            //             data: {
            //                 content: "Funds not received.",
            //             },
            //         }
            //     );
            // }
        } else if (name === "create_bet" && id) {
            const userId = req.body.member.user.id;

            // User's object choice
            const amount = parseFloat(req.body.data.options[0].value);
            const currency = req.body.data.options[1].value;
            const my_winner = req.body.data.options[2].value;
            const will_destroy = req.body.data.options[3].value;
            const challenger = req.body.data.options[4]?.value;

            const { success, id } = await placeBet(
                userId,
                amount,
                currency,
                my_winner,
                will_destroy,
                challenger
            );

            const message = `<@${userId}> thinks that ${my_winner} will destroy ${will_destroy} in their next game. He's betting ${amount} ${currency}! Will you accept the challenge${
                challenger ? " <@" + challenger + ">" : ""
            } ?`;
            const custom_id = `accept_button_${id}`;
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: message,
                    components: [
                        {
                            type: MessageComponentTypes.ACTION_ROW,
                            components: [
                                {
                                    type: MessageComponentTypes.BUTTON,
                                    // Append the game ID to use later on
                                    custom_id: custom_id,
                                    label: "Bet against",
                                    style: ButtonStyleTypes.SUCCESS,
                                },
                            ],
                        },
                    ],
                },
            });
        } else if (name === "withdraw" && id) {
            const userId = req.body.member.user.id;

            const amount = parseFloat(req.body.data.options[0].value);
            const currency = req.body.data.options[1].value.toUpperCase();
            const recipient = req.body.data.options[2].value;

            const { success, msg } = await withdraw(
                recipient,
                amount,
                userId,
                currency
            );

            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: msg,
                    flags: InteractionResponseFlags.EPHEMERAL,
                },
            });
        } else if (name === "send" && id) {
            const userId = req.body.member.user.id;

            const amount = parseFloat(req.body.data.options[0].value);
            const currency = req.body.data.options[1].value.toUpperCase();
            const recipient = req.body.data.options[2].value;

            const { success, msg } = await send(
                userId,
                currency,
                amount,
                recipient
            );

            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: msg,
                    flags: InteractionResponseFlags.EPHEMERAL,
                },
            });
        }
    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
        // custom_id set in payload when sending message component
        const componentId = data.custom_id;
        if (componentId.startsWith("accept_button_")) {
            // get the associated game ID
            const gameId = componentId.replace("accept_button_", "");
            try {
                const { success, msg } = await acceptBet(
                    req.body.member.user.id,
                    gameId
                );
                if (!success) {
                    return res.send({
                        type:
                            InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: msg,
                            flags: InteractionResponseFlags.EPHEMERAL,
                        },
                    });
                }
                // disable the button
                return res.send({
                    type: InteractionResponseType.UPDATE_MESSAGE,
                    data: {
                        content: `Bet #${gameId} is accepted!`,
                        // flags: InteractionResponseFlags.EPHEMERAL,
                    },
                });
                // await res.send({
                //     type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                //     data: {
                //         content: `Bet #${id} is settled!`,
                //     },
                // });
                // // Delete previous message
            } catch (err) {
                console.error("Error sending message:", err);
            }
        }
    }
});

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "soplay/"); // Set the destination directory
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Keep the original filename
    },
});

const upload = multer({ storage: storage });

// Route to handle file uploads
app.post("/solpay", upload.single("image"), (req, res) => {
    res.send("File uploaded successfully");
});

// Route to serve the uploaded file externally
app.get("/solpay/qrcode.png", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", filename);
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log("Listening on port", PORT);
});

/*
const riotApiKey = process.env.RIOT_API_KEY;

const bot = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

const RIOT_API_KEY = riotApiKey;

bot.once('ready', () => {
  console.log('Bot is online!');
});

bot.on('message', async (message) => {
  if (message.content.startsWith('!gameResult')) {
    const args = message.content.split(' ');
    if (args.length < 3) {
      message.channel.send('Please provide a region and a summoner name.');
      return;
    }

    const REGION = args[1];
    const SUMMONER_NAME = args.slice(2).join(' ');

    try {
      const summonerResponse = await axios.get(
        `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${SUMMONER_NAME}`,
        { headers: { 'X-Riot-Token': RIOT_API_KEY } }
      );

      const puuid = summonerResponse.data.puuid;

      const matchlistResponse = await axios.get(
        `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`,
        { headers: { 'X-Riot-Token': RIOT_API_KEY } }
      );

      const mostRecentMatchId = matchlistResponse.data[0];

      const matchDetails = await axios.get(
        `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${mostRecentMatchId}`,
        { headers: { 'X-Riot-Token': RIOT_API_KEY } }
      );

      const winningTeam = matchDetails.data.info.teams.find((team) => team.win).teamId == 100 ? 'Blue' : 'Red';
      message.channel.send(`The winning team is ${winningTeam}`);

    } catch (error) {
      console.error(error);
      message.channel.send('There was an error fetching the game results.');
    }
  }
}); */
