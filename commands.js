import "dotenv/config";
import { getRPSChoices } from "./game.js";
import { capitalize, InstallGlobalCommands } from "./utils.js";

// Get the game choices from game.js
function createCommandChoices() {
    const choices = getRPSChoices();
    const commandChoices = [];

    for (let choice of choices) {
        commandChoices.push({
            name: capitalize(choice),
            value: choice.toLowerCase(),
        });
    }

    return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
    name: "test",
    description: "Basic command",
    type: 1,
};

// Command containing options
const FUND = {
    name: "fundwallet",
    description: "Fund your Solana wallet",
    options: [
        {
            type: 3,
            name: "amount",
            description: "Define amount",
            required: true,
        },
        {
            type: 3,
            name: "currency",
            description: "Define currency",
            required: true,
            choices: createCommandChoices(),
        },
    ],
    type: 1,
};

const CREATE_BET = {
    name: "create_bet",
    description: "create a bet and ping someone",
    options: [
        {
            type: 3,
            name: "amount",
            description: "Define amount",
            required: true,
        },
        {
            type: 3,
            name: "currency",
            description: "Define currency",
            required: true,
            choices: createCommandChoices(),
        },
        {
            type: 3,
            name: "my_winner",
            description: "Player you bet on",
            required: true,
        },
        {
            type: 3,
            name: "will_destroy",
            description: "Player you bet against",
            required: true,
        },
        {
            type: 6,
            name: "challenger",
            description: "ping someone",
            required: false,
            choices: createCommandChoices(),
        },
    ],
    type: 1,
};

const ACCEPT_BET = {
    name: "accept_bet",
    description: "create a bet and ping someone",
    options: [
        {
            type: 3,
            name: "bet_id",
            description: "Bet you enter",
            required: true,
        },
        {
            type: 6,
            name: "challenger",
            description: "ping someone",
            required: false,
        },
    ],
    type: 1,
};

const ALL_COMMANDS = [TEST_COMMAND, FUND, CREATE_BET, ACCEPT_BET];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
