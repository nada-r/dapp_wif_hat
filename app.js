import { config } from 'dotenv';
config();
import express from 'express';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

console.log(`Hello ${process.env.HELLO}`)


const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

const activeGames = {};

app.post('/interactions', async function (req, res) {

    const { type, id, data } = req.body;

    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        if (name === 'test') {
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: 'hello world ' + getRandomEmoji(),
                },
            });
        }

        if (name === 'fundwallet' && id) {
          const userId = req.body.member.user.id;
          // User's object choice
          const objectName = req.body.data.options[0].value;
      
          // Create active game using message ID as the game ID
          activeGames[id] = {
              id: userId,
              objectName,
          };
      
          return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
              content: `Bet created by <@${userId}>`,
              components: [
              {
                  type: MessageComponentTypes.ACTION_ROW,
                  components: [
                  {
                      type: MessageComponentTypes.BUTTON,
                      // Append the game ID to use later on
                      custom_id: `accept_button_${req.body.id}`,
                      label: 'Accept',
                      style: ButtonStyleTypes.PRIMARY,
                  },
                  ],
              },
              ],
          },
          });
      }

    }
});

app.listen(PORT, () => {
    console.log('Listening on port', PORT);
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