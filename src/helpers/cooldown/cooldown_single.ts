import { Collection } from "discord.js";
import { Cooldown } from "@helpers/types.js";
import { CommandModule } from "@helpers/types.js";

export function getExpiredTimestamp(
	cooldowns: Collection<string, Cooldown>,
	command_module: CommandModule,
	author_id: string
) {
	const now = Date.now();
	const cooldown_name = `${author_id}-${command_module.name}`;
	const author_timestamp = cooldowns.get(cooldown_name);

	if (author_timestamp) {
		if (now < author_timestamp.cooldown) {
			if (!author_timestamp.hasMessaged) {
				author_timestamp.hasMessaged = true;
			}
			const expired_timestamp = Math.round(author_timestamp.cooldown / 1000);
			return expired_timestamp;
		}
	}
}

export async function setCooldown(
	cooldowns: Collection<string, Cooldown>,
	command_module: CommandModule,
	author_id: string,
	args: string[]
) {
	const now = Date.now();
	const cooldown_amount = command_module.cooldown * 1000;
	const cooldown_additional = await getDynamicCooldown(
		args,
		command_module.dyn_cooldown
	);
	const cooldown_combine = cooldown_amount + cooldown_additional;
	const cooldown_name = `${author_id}-${command_module.name}`;

	cooldowns.set(cooldown_name, {
		cooldown: cooldown_combine + now,
		hasMessaged: false,
	});
	setTimeout(() => cooldowns.delete(cooldown_name), cooldown_combine);
}

async function getDynamicCooldown(
	args: string[],
	dyn_cooldown?: (_args: string[]) => Promise<number>
): Promise<number> {
	return dyn_cooldown ? (await dyn_cooldown(args)) * 1000 : 0;
}
