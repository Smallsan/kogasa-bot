import {ExternalDependencies} from "@helpers/types";
import { ChannelType, Client, EmbedBuilder, Guild, Message, PermissionsBitField, TextChannel } from "discord.js";
import { ChannelScope } from "@helpers/types";
import Pocketbase, { RecordModel, RecordService } from "pocketbase";
import { createHash } from "node:crypto";

interface PBGuild extends RecordModel {
	confess: string
}
interface PBConfess extends RecordModel {
	channel_id: string,
	users: {
		confessed: string[],
		banned: string[],
	},
}

async function setup(msg: Message, pb: Pocketbase) {
	const channel_hash = hash(msg.channelId, 15);
	const guild_hash = hash(msg.guild!.id, 15);
	const pb_channels = pb.collection("confess");
	const pb_guild = pb.collection("guild");

	// makes a channel, makes a guild (if unavailable), connects those two.
	const previous_channel = await getRecord<PBConfess>(pb_channels, channel_hash);
	if (previous_channel) {
		await pb_channels.delete(previous_channel.id);
	}
	const current_channel = await pb_channels.create<PBConfess>({ 
		id: channel_hash, 
		channel_id: msg.channelId,
		users: {
			confessed: previous_channel?.users.confessed ?? [],
			banned: previous_channel?.users.banned ?? [],
		}
	});
	const guild = await getRecord<PBGuild>(pb_guild, guild_hash);
	if (guild) {
		await pb_guild.update(guild.id, { "confess": [current_channel.id] });
		msg.reply(`You switched the confess channel to #${(msg.channel as TextChannel).name}`);
	} else {
		await pb_guild.create({ "id": guild_hash, "confess": [current_channel.id] });
		msg.reply(`You set up the confess channel on #${(msg.channel as TextChannel).name}`);
	}
}

async function listConfessServers(client: Client<true>, msg: Message, pb: Pocketbase) {
	const confess_activated_guilds: { guild: Guild, channel: TextChannel }[] = [];
	const pb_guild_collection = pb.collection("guild");
	const pb_channel_collection = pb.collection("confess");

	for (const guild of client.guilds.cache.values()) {
		if (guild.members.cache.has(msg.author.id)) { // checking mutually joined servers with user.
			const pb_guild = await getRecord<PBGuild>(pb_guild_collection, hash(guild.id, 15));
			if (pb_guild && pb_guild.confess) { // checking if that guild has activated the feature.
				const pb_confess = await getRecord<PBConfess>(pb_channel_collection, pb_guild.confess);
				if (!pb_confess) {
					continue;
				}
				// quite confident it will be a GuildChannel because of the previous check (msg.channel.type === ChannelType.GuildText)
				const confess_channel = await guild.channels.fetch(pb_confess?.channel_id) as TextChannel;
				if (!confess_channel) {
					continue;
				}
				confess_activated_guilds.push({ guild: guild, channel: confess_channel });
			}
		}
	}

	return confess_activated_guilds;
}

async function runConfess(
	client: Client<true>, msg: Message, pb: Pocketbase,
	confess: { guild: Guild, channel: TextChannel }, text: string,
) {
	const hash_channel_id = hash(confess.channel.id, 15);
	const channels = pb.collection("confess");
	const channel_record = await getRecord<PBConfess>(channels, hash_channel_id);

	// ban logic
	if (channel_record?.users.banned.find((id) => id === msg.author.id)) {
		msg.reply(`You're banned from confessing to ${confess.guild.name}. Ask a mod there to unban you.`);
		return;
	}

	const confessed_length = channel_record?.users.confessed.push(msg.author.id);
	await channels.update<PBConfess>(hash_channel_id, { users: channel_record?.users });

	const embed = new EmbedBuilder();
	embed.setTitle(`Confession #${confessed_length}`);
	embed.setDescription(text.slice(0, 500)); // no idea what the description limit is.

	confess.channel.send({ embeds: [embed] });
	msg.reply(`Sent to #${confess.channel.name} at ${confess.guild.name}`);
}

async function sendConfessEmbed(msg: Message, confess_activated_guilds: { guild: Guild, channel: TextChannel }[]) {
	const embed = new EmbedBuilder();
	embed.setTitle("Choose a server to confess on: ");
	for (let index = 0; index < confess_activated_guilds.length; index++) {
		const guild = confess_activated_guilds[index];
		embed.addFields({name: `#${index} ${guild.guild.name}`, value: `At: ${guild.channel.name}`, inline: true});
	}
	msg.author.send({ content: "Choose with `!!confess [index (the one with the hashtag)] [text]`", embeds: [embed] });
}

async function banUserFromConfess(pb: Pocketbase, msg: Message, confession_index: number) {
	const channel_hash = hash(msg.channelId, 15);
	const pb_confess = pb.collection("confess");
	const record = await getRecord<PBConfess>(pb_confess, channel_hash);
	if (record) {
		const confess_user = record.users.confessed.at(Math.abs(confession_index - 1));
		if (confess_user) {
			record.users.banned.push(confess_user);
			await pb_confess.update<PBConfess>(channel_hash, {users: record.users});
			msg.reply(`Banned confession #${confession_index}`);
		} else {
			msg.reply(`Confession #${confession_index} doesn't exist!`);
		}
	} else {
		msg.reply("Please invoke the command on a confess activated channel.");
	}
}

async function unbanUserFromConfess(pb: Pocketbase, msg: Message) {
	const id_of_unban = msg.mentions.users.first()?.id;
	const channel_hash = hash(msg.channelId, 15);
	const pb_confess = pb.collection("confess");
	const record = await getRecord<PBConfess>(pb_confess, channel_hash);
	if (record) {
		const banned_index = record.users.banned.findIndex((id) => id === id_of_unban);
		if (banned_index !== -1) {
			record.users.banned.splice(banned_index, 1);
			await pb_confess.update<PBConfess>(channel_hash, { 
				users: { 
					banned: record.users.banned, 
					confessed: record.users.confessed 
				}
			});
			msg.reply("Unbanned user from confessing.");
		} else {
			msg.reply("User isn't banned from confessing!");
		}
	} else {
		msg.reply("Please invoke the command on a confess activated channel.");
	}
}


export const name = "confess";
export const aliases = [];
export const channel: ChannelScope[] = ["DMs", "Guild"];
export const cooldown = 15;
export const description = "Secretly send a message.";
export const extended_description = "Do `??dm` if you're running this command for the first time."
	+ "\nTo confess, you must do `??confess` in DMs first and follow the instructions listed there."
	+ "\nFor server owners, `??confess ban (confession number)` and `??confess ban @User` to moderate it."
	+ "\n`??confess` in a channel to set it up.";
// to do: the ability to remove the confess feature entirely.
export async function execute(client: Client<true>, msg: Message, args: string[], ext: ExternalDependencies) {
	if (msg.channel.type === ChannelType.DM) {
		const index = Number(args.at(0));
		const text = args.slice(1).join(" ");

		const confess_activated_guilds = await listConfessServers(client, msg, ext.pb);
		if (!isNaN(index) && text.length !== 0) {
			const confess_guild = confess_activated_guilds.at(index);
			if (!confess_guild) {
				msg.reply("No guild associated with the index.");
				return;
			}
			runConfess(client, msg, ext.pb, confess_guild, text);
		} else {
			if (confess_activated_guilds.length <= 0) {
				msg.reply("You have no servers that are available to confess on.");
				return;
			}
			sendConfessEmbed(msg, confess_activated_guilds);
		}
	}

	if (msg.channel.type === ChannelType.GuildText) {
		const selection = args.at(0);
		const confession_index = Number(args.at(1));

		switch (selection) {
			case "ban": {
				if (isNaN(confession_index)) {
					msg.reply("Please choose a confession to delete: `??confess ban [confession number]`");
					return;
				}
				const has_perms = msg.member?.permissions.has(PermissionsBitField.Flags.MuteMembers);
				if (!has_perms) {
					msg.reply("You need to have the Mute Members permission before being able to mute confessors.");
					return;
				}
				banUserFromConfess(ext.pb, msg, confession_index);
				break;
			}
			case "unban": {
				const has_perms = msg.member?.permissions.has(PermissionsBitField.Flags.MuteMembers);
				if (!has_perms) {
					msg.reply("You need to have the Mute Members permission before being able to mute confessors.");
					return;
				}
				unbanUserFromConfess(ext.pb, msg);
				break;
			}
			default: {
				const has_perms = msg.member?.permissions.has(PermissionsBitField.Flags.ManageChannels);
				if (!has_perms) {
					msg.reply("Please DM me if you want to confess, and do `??help confess` there.");
					return;
				}
				await setup(msg, ext.pb);
				break;
			}
		}
	}
}

function hash(content: string, hash_length: number) {
	return createHash("sha256").update(content).digest("hex").toString().slice(0, hash_length);
}
async function getRecord<T extends RecordModel>(collection: RecordService<T>, id: string): Promise<T | undefined> {
	try {
		return await collection.getOne(id);
	} catch (error) {
		return undefined;
	}
}
