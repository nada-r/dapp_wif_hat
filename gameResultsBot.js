require('dotenv').config();
const { Client, Intents } = require('discord.js');

const discordBotToken = process.env.DISCORD_BOT_TOKEN;
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
});

bot.login(discordBotToken);