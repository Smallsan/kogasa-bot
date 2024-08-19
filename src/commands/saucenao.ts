import sagiri from "sagiri";
import mimetype from "mime-types";
import { Client, Message } from "discord.js";

import config from "@root/config.json" assert { type: "json" };
import { checkIfLink } from "@helpers/misc/link.js";
import { ChannelScope } from "@helpers/types";

const sauce = sagiri(config.saucenao_token, { results: 2 });

export const name = "sauce";
export const cooldown = 60;
export const channel: ChannelScope[] = ["Guild", "Thread"];
export const description =
	"Find the sauce. Reply or send a link/attachment to me.";
export async function execute(client: Client, msg: Message, args: string[]) {
	let response = "";

	const link = args.at(0);

	if (msg.reference?.messageId !== undefined) {
		const replied = await msg.channel.messages.fetch(msg.reference.messageId);
		if (replied.attachments.size >= 1) {
			response = await useAttachments(replied);
		}
	} else if (link) {
		response = await useLink(link);
	} else if (msg.attachments.size >= 1) {
		response = await useAttachments(msg);
	} else {
		response = "`??sauce [replied to image] [link or attachment]` You're missing one of these.";
	}
	msg.reply(response);
}

/**
 * if the user's request looks like: `??sauce` [replying to someone's image attachment];
 *
 * modifies the response string
 */
async function useAttachments(msg: Message) {
	let response = "## Sources found?:\n\n";

	const first_attachment = msg.attachments.at(0)!;
	const mime_lookup =
		first_attachment.contentType ?? mimetype.lookup(first_attachment.name);

	if (mime_lookup) {
		const match = mime_lookup.match(/image\/.+/);
		if (!match?.[0]) {
			response = "You given me a non-image.";
			return response;
		}
	}

	const sources = await sauce(first_attachment.url);
	for (const source of sources) {
		response += `- [\`${source.authorName}\` posted to \`${source.site}\`](<${source.url}>) with a \`${source.similarity}\`pt.\n`;
	}

	return response;
}

/**
 * if the user's request looks like: `??sauce [link]`
 *
 * modifies the response string
 */
async function useLink(link: string) {
	let response = "## Sources found?:\n\n";

	const is_link = checkIfLink(link);
	if (!is_link) {
		response = "You did not give me a link.";
		return response;
	}
	try {
		const sources = await sauce(link);
		for (const source of sources)
			response += `- [\`${source.authorName}\` posted to \`${source.site}\`](<${source.url}>) with a \`${source.similarity}\`pt.\n`;
	} catch (err) {
		response = "An error has occured with parsing your link.";
	}

	return response;
}
