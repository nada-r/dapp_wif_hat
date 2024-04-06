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
import { acceptBet, placeBet, fundWallet } from "./back.js";
import axios from "axios";
import { google } from "googleapis";
import QRCode from "qrcode";
import fs from "fs";

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

            QRCode.toFile("./qrcode.png", url, function (err) {
                if (err) throw err;
                console.log("QR code image saved.");
            });
            // Créez un JWT pour l'authentification
            const jwtClient = new google.auth.JWT(
                process.env.GOOGLE_CLIENT_EMAIL,
                null,
                process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
                ["https://www.googleapis.com/auth/drive"]
            );

            // Authentifiez-vous avec Google Drive
            jwtClient.authorize(function (err, tokens) {
                if (err) {
                    console.log(err);
                    return;
                }

                const drive = google.drive({ version: "v3", auth: jwtClient });

                // Téléchargez l'image sur Google Drive
                const fileMetadata = {
                    name: "solanaPay.png",
                };
                const media = {
                    mimeType: "image/png",
                    body: fs.createReadStream(
                        path.join(__dirname, "myImage.png")
                    ),
                };
                drive.files.create(
                    {
                        resource: fileMetadata,
                        media: media,
                        fields: "id",
                    },
                    function (err, file) {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        // Obtenez l'URL de l'image
                        const imageUrl = `https://drive.google.com/uc?export=view&id=${file.data.id}`;

                        // Envoyez l'image à Discord
                        axios.post(
                            "https://discord.com/api/webhooks/your-webhook-id",
                            {
                                content: "Voici votre image :",
                                embeds: [
                                    {
                                        image: {
                                            url: imageUrl,
                                        },
                                    },
                                ],
                            }
                        );
                    }
                );
            });

            const output = await axios.request(input);

            console.log(output.data.url);

            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Scan the QR code to fund your wallet",
                    embeds: [
                        {
                            title: "QR Code",
                            image: {
                                url: output.data.url,
                            },
                        },
                    ],
                },
            });
        } else if (name === "create_bet" && id) {
            const userId = req.body.member.user.id;

            // User's object choice
            const amount = parseFloat(req.body.data.options[0].value);
            const currency = req.body.data.options[1].value;
            const my_winner = req.body.data.options[2].value;
            const will_destroy = req.body.data.options[3].value;
            const challenger = req.body.data.options[4].value;

            const { id } = placeBet(
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
                                    custom_id: `accept_button_${id}`,
                                    label: "Bet against",
                                    style: ButtonStyleTypes.SUCCESS,
                                },
                            ],
                        },
                    ],
                },
            });
        } else if (name === "accept_bet" && id) {
            const userId = req.body.member.user.id;

            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `Bet accepted by <@${userId}>`,
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
                const id = acceptBet(req.body.member.user.id, gameId);
                await res.send({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        // Fetches a random emoji to send from a helper function
                        content: "What is your object of choice?",
                        // Indicates it'll be an ephemeral message
                        flags: InteractionResponseFlags.EPHEMERAL,
                        components: [
                            {
                                type: MessageComponentTypes.ACTION_ROW,
                                components: [
                                    {
                                        type:
                                            MessageComponentTypes.STRING_SELECT,
                                        // Append game ID
                                        custom_id: `select_choice_${gameId}`,
                                        options: getShuffledOptions(),
                                    },
                                ],
                            },
                        ],
                    },
                });
                // Delete previous message
                await DiscordRequest(endpoint, { method: "DELETE" });
            } catch (err) {
                console.error("Error sending message:", err);
            }
        }
    }
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
