import chalk from "chalk";
import * as url from 'url';
import path from "path";
import Pocketbase from "pocketbase";
import { Client, Collection, ChannelType, Message, ActivityType, Options } from "discord.js";

import { enableAutoDelete } from "./src/startup.js";
import helpers, { CommandModule, Cooldown, ExternalDependencies, Tier } from "./src/helpers/helpers.js";
import { Queue } from "./src/helpers/misc/queue.js";

import settings from "./settings.json" assert { type: "json" };
import config from "./config.json" assert { type: "json" };
import {ChatBuffer, Website} from "./src/helpers/types.js";
import {getMessage} from "./src/helpers/misc/fetch.js";
import {pickRandom} from "./src/helpers/misc/random.js";

///////////////////////////////////////////////////////////////////////////////////////////////

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const client = new Client({
    intents: ["Guilds", "GuildMessages", "MessageContent", "GuildIntegrations"],
		makeCache: Options.cacheWithLimits({
			...Options.DefaultMakeCacheSettings,
			MessageManager: 2000,
			UserManager: 100,
		}),
});
const pb = new Pocketbase("http://127.0.0.1:8090");

const commands = new Collection<string, CommandModule>()
    .concat(
        (await helpers.importDirectories(__dirname, "/src/commands/")),
        (await helpers.importDirectories(__dirname, "/src/commands/specials/")),
        (await helpers.importDirectories(__dirname, "/src/commands/settings/")),
    );
// { alias: name }
const aliases = helpers.postprocessAliases(commands);
const cooldowns = new Collection<string, Collection<string, Cooldown>>();
const websites: Website[] = await helpers.grabAllRandomWebsites(path.join(__dirname, "./media/randomweb.jsonl"))
const tiers = new Map<string, Tier>([
	["C", {chance: 137, name: "Common", emote: ":cd:"}], // implement low_chance and high_chance to compare together
	["UC", {chance: 220, name: "Uncommon", emote: ":comet:"}],
	["R", {chance: 275, name: "Rare", emote: ":sparkles:"}],
	["SR", {chance: 298, name: "Super Rare", emote: ":sparkles::camping:"}],
	["Q", {chance: 300, name: "Flower", emote: ":white_flower:"}]
]);

const chat_buffer: ChatBuffer = new Map();

if (!settings.test)
    await enableAutoDelete();

client.on("messageUpdate", async (partial_old_msg, partial_new_msg) => {
	const old_msg = await getMessage(client, partial_old_msg.channelId, partial_old_msg.id);
	const new_msg = await getMessage(client, partial_new_msg.channelId, partial_new_msg.id);
	if (!(new_msg && old_msg))
		return;

	const chat_buffer_channel = chat_buffer.get(new_msg.channelId)!;
	const replied = new_msg.reference && new_msg.reference.messageId
		? await getMessage(client, new_msg.reference.channelId, new_msg.reference.messageId) 
		: null;
	const chat_buffer_message = chat_buffer_channel.get_internal().find((buffer_message) => buffer_message.id === new_msg.id);
	const replied_buffer_message = chat_buffer_channel
		.get_internal()
		.find((buffer_message) => {
			if (buffer_message.replied && replied) {
				return buffer_message.replied.id === replied.id
			}
			return false;
		});
	if (chat_buffer_message) {
		chat_buffer_message.content = new_msg.content;
		chat_buffer_message.edits.push(old_msg.content);
	}
	if (replied_buffer_message) {
		replied_buffer_message.content = new_msg.content;
	}
})

client.on("messageDelete", async (msg) => {
	let chat_buffer_channel = chat_buffer.get(msg.channelId)!;
	const replied = msg.reference && msg.reference.messageId
		? await getMessage(client, msg.reference.channelId, msg.reference.messageId) 
		: null;
	const chat_buffer_message = chat_buffer_channel.get_internal().find((buffer_message) => buffer_message.id === msg.id);
	const replied_buffer_message = chat_buffer_channel
		.get_internal()
		.find((buffer_message) => {
			if (buffer_message.replied && replied) {
				return buffer_message.replied.id === replied.id
			}
			return false;
		});
	if (chat_buffer_message) {
		chat_buffer_message.is_deleted = true;
	}
	if (replied_buffer_message) {
		replied_buffer_message.is_deleted = true;
	}
})

client.on("messageCreate", async (msg) => {
    if (msg.channel.type !== ChannelType.GuildText)
        return;

		let chat_buffer_channel = chat_buffer.get(msg.channelId);
		if (chat_buffer_channel === undefined) {
			chat_buffer.set(msg.channelId, new Queue(15));
			chat_buffer_channel = chat_buffer.get(msg.channelId);
		}
		const replied = msg.reference && msg.reference.messageId
			? await getMessage(client, msg.reference.channelId, msg.reference.messageId) 
			: null;
			
		chat_buffer_channel!.push({
			id: msg.id,
			display_name: msg.author.displayName,
			content: msg.content,
			is_deleted: false,
			edits: [] as string[],
			replied: replied 
				? {
						id: replied.id,
						display_name: replied.author.displayName,
						content: replied.content,
						is_deleted: false,
						edits: [] as string[]
				} : undefined
		});

    if (msg.author.bot)
        return;

    // local prefix changing
    const prefix = await helpers.prefixChange(pb, settings.test, msg.channel.guildId);

    if (!msg.content.startsWith(prefix))
        return;

    const c = msg.content.split(" ");
    const args = msg.content.split(" ");
    const name = c[0].replace(prefix, "");

	// alias integration
    const command = aliasToCommand(name);
    args.shift();

    try {
        if (!command) {
			// fuzzy searching for commands
			return;
		};
        // scoping
        if (!command.noscope) {
            const response = await helpers.commandChannelAccess(pb, name, msg.channel.id, msg.channel.guildId)
            if (response) {
                msg.reply(response);
                return;
            }
        }

        // cooldowns
        if (!cooldowns.has(command.name)) {
            cooldowns.set(command.name, new Collection<string, Cooldown>());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.name);
        const cooldownAmount = command.cooldown * 1000;
        const author_id = msg.author.id;

        if (!timestamps) {
            return;
        }

        if (timestamps.has(author_id)) {
            const expirationTime = timestamps.get(author_id)!;
            if (now < expirationTime.cooldown) {
                const expiredTimestamp = Math.round(expirationTime.cooldown / 1000);
                if (!expirationTime.hasMessaged) {
					msg.reply(
                    	`Please wait, you are on a cooldown for \`${command.name}\`.`
                    	+ ` You can use it again <t:${expiredTimestamp}:R>.`);
					expirationTime.hasMessaged = true;
				}
            }
            return;
        }

        if (command.checker) {
            const pass = await command.checker(msg, args);
            if (!pass) {
                return;
            }
        }

        const cooldownAdditional = command.dyn_cooldown
            ? await command.dyn_cooldown(args) * 1000
            : 0;

        timestamps?.set(author_id, {
					cooldown: now + cooldownAdditional + cooldownAmount,
					hasMessaged: false,
				});
        setTimeout(() => timestamps.delete(author_id), cooldownAmount + cooldownAdditional);

        const ext: ExternalDependencies = {
            pb: pb,
            commands: commands,
            prefix: prefix,
            external_data: [websites, tiers, chat_buffer]
        }
        command.execute(client, msg, args, ext);
    } catch (err) {
        console.error(err);
    }
});

function aliasToCommand(alias: string) {
	const command_name = aliases.get(alias);
	if (command_name) {
    	return commands.get(command_name);
	}
	return commands.get(alias);
}

client.on("ready", async (client) => {
    console.log(`Done! [Test mode: ${settings.test}]`);
		const presence = pickRandom([
			"the Human Village",
			"Alice's Bed",
			"the Road to Eientei",
			"Marisa in the Forest of Magic",
			"Reimu in the Hakurei Shrine",
			"the skies"
		]);
		setInterval(() => {
			client.user.setPresence({
				activities: [{
					name: presence,
					type: ActivityType.Watching,
				}],
				status: "online",
			});
		}, 1000 * 60)
});
client.login(settings.test ? config.test_token : config.token)
