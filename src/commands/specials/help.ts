import helpers, { ExternalDependencies } from "@helpers/helpers.js";
import { Client, Message, EmbedBuilder, GuildChannel, ThreadChannel, DMChannel } from "discord.js";
import { ChannelScope } from "@helpers/types";

export const name = "help";
export const cooldown = 5;
export const special = true;
export const channel: ChannelScope[] = ["Guild", "DMs", "Thread"];
export const description = "Check what I can do.";
export const extended_description = "??help [command], you can specify now.";
export const noscope = true;
export async function execute(
	client: Client,
	msg: Message,
	args: string[],
	ext: ExternalDependencies
) {
	const command_name = args.at(0);

	if (command_name) {
		const command = ext.commands.find((c) => c.name === command_name);
		if (command) {
			const aliases = command.aliases && command.aliases.length >= 1 ? command.aliases.join(" ") : "None";
			let description = "**Description**: " + command.description ?? "No description.";
			description += "\n**Extended Description**: " + (command.extended_description ?? "No extended description.");
			description += "\n**Aliases**: " + aliases;
			const embed = new EmbedBuilder()
				.setTitle(`??${command.name}`)
				.setDescription(description);
			msg.reply({ embeds: [embed] });
		}
		return;
	}

	const channel_types: [typeof GuildChannel | typeof ThreadChannel | typeof DMChannel, ChannelScope][] = [[DMChannel, "DMs"], [GuildChannel, "Guild"], [ThreadChannel, "Thread"]];
	const embed = new EmbedBuilder().setTitle("Help! Bad Apple!");
	let command_list = "";
	for (const [name, command] of ext.commands) {
		if (channel_types.some(([t, scope]) => command.channel.includes(scope) && msg.channel instanceof t)) {
			command_list += `**${ext.prefix}${name}**\n`;
		}
	}
	embed.setDescription(command_list);
	msg.reply({ embeds: [embed] });
}
