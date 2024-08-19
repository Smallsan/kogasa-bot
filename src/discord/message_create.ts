import { Client, Collection, DMChannel, GuildChannel, Message, ThreadChannel } from "discord.js";
import { pushMessageToBuffer } from "@helpers/buffer/buffer.js";
import { separateCommands } from "@helpers/parser/parser.js";
import {
	CommandModule,
	Tiers,
	Cooldown,
	ExternalDependencies,
	DiscordExternalDependencies,
} from "@helpers/types.js";
import settings from "@root/settings.json" assert { type: "json" };
import {
	getExpiredTimestamp,
	setCooldown,
} from "@helpers/cooldown/cooldown_single.js";
import { ChannelScope } from "@helpers/types.js";

const user_cooldowns = new Collection<string, Cooldown>();

const tiers: [Tiers, number][] = [["C", 0.50], ["UC", 0.30], ["R", 0.15], ["SR", 0.04999], ["Q", 0.0001]];
const channel_types: [typeof GuildChannel | typeof ThreadChannel | typeof DMChannel, ChannelScope][] = [[DMChannel, "DMs"], [GuildChannel, "Guild"], [ThreadChannel, "Thread"]];

export async function messageCreate(
	client: Client,
	msg: Message,
	deps: DiscordExternalDependencies,
	prefix: string,
) {
	// make it support threads.
	if (msg.author.bot) {
		return;
	}

	await pushMessageToBuffer(client, msg, deps.chat_buffer);

	////////////////// COMMAND STUFF BELOW //////////////////
	if (!msg.content.startsWith(prefix)) {
		return;
	}

	const { args, alias_command_name } = separateCommands(msg.content, prefix);
	const command_module = aliasNameToCommand(
		deps.aliases,
		deps.commands,
		alias_command_name
	);

	try {
		if (!command_module) {
			return;
		}

		const expired_timestamp = getExpiredTimestamp(
			user_cooldowns,
			command_module,
			msg.author.id
		);
		if (expired_timestamp) {
			msg.reply(
				`Please wait, you are on a cooldown for \`${command_module.name}\`.` +
					` You can use it again <t:${expired_timestamp}:R>.`
			);
			return;
		}
		if (command_module.checker) {
			const has_passed_check = await command_module.checker(msg, args);
			if (!has_passed_check) {
				return;
			}
		}

		if (channel_types.some(([t, scope]) => command_module.channel.includes(scope) && msg.channel instanceof t)) {
			setCooldown(user_cooldowns, command_module, msg.author.id, args);
			const ext: ExternalDependencies = {
				commands: deps.commands,
				prefix: prefix,
				websites: deps.websites,
				tiers: tiers,
				chat_buffer: deps.chat_buffer,
				settings: settings,
				pb: deps.pb,
			};
			command_module.execute(client, msg, args, ext);
		}

	} catch (err) {
		console.error(err);
	}
}

function aliasNameToCommand(
	aliases: Map<string, string>,
	commands: Collection<string, CommandModule>,
	alias: string
) {
	const command_name = aliases.get(alias);
	if (command_name) {
		return commands.get(command_name);
	}
	return commands.get(alias);
}
