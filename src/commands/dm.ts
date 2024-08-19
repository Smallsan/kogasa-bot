
import { Client, Message } from "discord.js";
import { ChannelScope } from "@helpers/types";

export const name = "dm";
export const aliases = [];
export const channel: ChannelScope[] = ["Guild"];
export const cooldown = 120;
export const description = "Enable DM-only commands, like ??confess.";
export async function execute(_client: Client, msg: Message) {
	const dm = await msg.author.createDM();
	const message = "DM-only commands activated.";
	await dm.send(message);
}
