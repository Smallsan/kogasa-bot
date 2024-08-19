
import path from "path";
import * as url from "url";
import { Client, Collection, Options, User } from "discord.js";
import Pocketbase from "pocketbase";

import {
	ChatBuffer,
	DiscordExternalDependencies,
	Website,
} from "./src/helpers/types.js";
import { enableAutoDelete } from "./src/startup.js";
import helpers, { CommandModule } from "./src/helpers/helpers.js";

import settings from "@root/settings.json" assert { type: "json" };
import config from "@root/config.json" assert { type: "json" };

import { messageUpdate } from "./src/discord/message_update.js";
import { messageDelete } from "./src/discord/message_delete.js";
import { messageCreate } from "./src/discord/message_create.js";
import { ready } from "./src/discord/ready.js";

///////////////////////////////////////////////////////////////////////////////////
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const client = new Client({
	intents: ["Guilds", "GuildMessages", "MessageContent", "GuildIntegrations", "DirectMessages"],
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		MessageManager: 2000,
		UserManager: 100,
	}),
});
const pb = new Pocketbase("http://127.0.0.1:8090");
///////////////////////////////////////////////////////////////////////////////////
const commands = new Collection<string, CommandModule>().concat(
	await helpers.importDirectories(__dirname, "/src/commands/"),
	await helpers.importDirectories(__dirname, "/src/commands/specials/"),
);
const websites: Website[] = await helpers.grabAllRandomWebsites(
	path.join(__dirname, "./media/randomweb.jsonl")
);
const aliases = helpers.postProcessAliases(commands);
const chat_buffer: ChatBuffer = new Map();
const other_dependencies: DiscordExternalDependencies = {
	commands,
	aliases,
	chat_buffer,
	websites,
	pb,
};
//////////////////////////////////////////////////////////////////////////////////
if (!settings.test) await enableAutoDelete();

client.on(
	"messageCreate",
	async (msg) => await messageCreate(client, msg, other_dependencies, settings.test ? "!!" : settings.prefix)
);
client.on(
	"messageUpdate",
	async (msg) => await messageUpdate(client, msg, chat_buffer)
);
client.on(
	"messageDelete",
	async (msg) => await messageDelete(client, msg, chat_buffer)
);
client.on("cacheSweep", (message) => {
	console.log(`Sweeped cache: ${message}`);
});
client.on("ready", (client) => ready(client, settings));
if (settings.offlineMode) {
	console.log("Running in offline mode. Exiting...");
	process.exit(0);
} else {
	client.login(settings.test ? config.test_token : config.token);
}
