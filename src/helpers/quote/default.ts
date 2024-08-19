import fetch from "node-fetch";
import settings from "@root/settings.json" assert { type: "json" };

export async function quoteDefault(
	text: string,
	author: string,
	avatar_url: string,
) {
	const check = await fetch(`${settings.canvas_endpoint}/quote`, {
		method: "POST",
		body: JSON.stringify({
			text: text,
			author: author,
			avatar_url: avatar_url,
		}),
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});
	return Buffer.from(await check.arrayBuffer());
}
