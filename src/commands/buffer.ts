import { Client, EmbedBuilder, Message } from "discord.js";
import { ChatBufferMessage, ExternalDependencies } from "@helpers/types.js";
import { ChannelScope } from "@helpers/types.js";

type Filter = "delete" | "edit" | "normal" | "none";

export const name = "buffer";
export const aliases = ["back", "backtrack", "b"];
export const cooldown = 20;
export const channel: ChannelScope[] = ["Guild", "Thread"];
export const description =
	"Backtrack a channel. `??buffer (delete | edit | normal | none)`";
export const extended_description = "`??buffer delete` sends the deleted messages."
	+ "`??buffer edit` sends the edited messages."
	+ "`??buffer` sends everything the bot has logged in.";
export async function execute(
	_: Client,
	msg: Message,
	args: string[],
	external_data: ExternalDependencies
) {
	const filter_args = args.at(0);

	let filter: Filter = "none";
	if (filter_args) {
		if (["delete", "edit", "normal", "none"].includes(filter_args)) {
			filter = filter_args as Filter;
		}
	}

	const queue_collection = external_data.chat_buffer;
	const queue = queue_collection.get(msg.channelId);
	const embed = new EmbedBuilder().setTitle("Backtracked.").setColor("Navy");
	if (queue) {
		const messages = filterChatBuffer(filter, queue.get_internal());
		if (messages.length < 1) {
			msg.reply("No messages found.");
			return;
		}

		const format: string[] = [];

		for (const message of messages) {
			format.push(`${formatMessage(message, 2000)}\n`);
			while (format.join("").length > 4000) {
				shortenLongestString(format);
			}
		}
		embed.setDescription(format.join(""));
	} else {
		embed.setDescription("No messages found.");
	}
	const r = await msg.reply({ embeds: [embed] });
	setTimeout(async () => {
		r.delete().catch(() => {});
	}, 5 * 1000);
}

function limitMessageLength(message: ChatBufferMessage, maxLength: number) {
	if (message.content.length > maxLength) {
		return message.content.substring(0, maxLength);
	}
	return message.content;
}

// mutates array
function shortenLongestString(stringBuffer: string[]) {
	let maxLength = 0;
	let indexToRemove = -1;

	for (let i = 0; i < stringBuffer.length; i++) {
		const string = stringBuffer[i];
		if (string.length > maxLength) {
			maxLength = string.length;
			indexToRemove = i;
		}
	}

	if (indexToRemove !== -1) {
		const maxStringLength = stringBuffer[indexToRemove].length * 0.5;
		const longestString = stringBuffer[indexToRemove];
		const shortenedString = longestString.substring(0, maxStringLength);
		stringBuffer[indexToRemove] = shortenedString + "..." + "\n";
	}
}

function filterChatBuffer(filter: Filter, buffer: ChatBufferMessage[]) {
	switch (filter) {
		case "delete":
			return buffer.filter((v) => v.is_deleted === true);
		case "edit":
			return buffer.filter((v) => v.edits.length >= 1);
		case "normal":
			return buffer.filter((v) => v.is_deleted === false && v.edits.length < 1);
		case "none":
		default:
			return buffer;
	}
}

function formatMessage(message: ChatBufferMessage, maxMessageLength: number) {
	let format = "";

	if (message.replied) {
		// const attachments = formatAttachments(message.replied);
		const deleted = addDeleteTag(message.replied);
		format += `╔═ \`${message.replied.display_name}\` ${deleted}: ${message.replied.content}\n`;
	}

	// const attachments = formatAttachments(message);
	const delete_tag = addDeleteTag(message);
	const edits = formatEdits(message);
	const message_content_limited = limitMessageLength(message, maxMessageLength);

	format += `\`${message.display_name}\`${delete_tag}: ${edits} ${message_content_limited}`;

	return format;
}

/**
 * Due to issues with privacy, this is disabled for now.
 */
function _formatAttachments(message: ChatBufferMessage) {
	const colon =
		message.attachments.length >= 1 && message.content.length > 0 ? ":" : "";
	const attachments = message.attachments
		.map((v, i) => `[Attachment ${i + 1}](${v})`)
		.join(" ");
	return `${colon} ${attachments}`;
}
function formatEdits(message: ChatBufferMessage) {
	const newline_edits = `${message.edits.length >= 1 ? "\n" : ""}`;
	return newline_edits + message.edits.map((v) => `||${v}||\n`).join("");
}
function addDeleteTag(message: ChatBufferMessage) {
	return message.is_deleted ? " [DELETED]" : "";
}
