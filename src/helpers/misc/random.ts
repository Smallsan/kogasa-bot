import fs from "fs";
import readline from "readline";
import seedrandom from "seedrandom";
import random from "random";
import crypto from "crypto";
import { Tiers, Website } from "../types";

const seed = crypto.randomBytes(400).toString();
const rng = random.clone(seedrandom(seed, { entropy: true }));
/*
 * min: inclusive, max: inclusive
 *
 * Impure function.
 */
export function getRandomInt(min: number, max: number) {
	return rng.uniformInt(min, max)();
}

export function generateWeightedRandomTable(chances: [string, number][]) {
	const table: string[] = [];
	for (const [name, loop_amount] of chances) {
		for (let i = 0; i < loop_amount; i++) {
			table.push(name);
		}
	}
	return table;
}
export function weightedPicker(chances: [string, number][]) {
	const length = 100_000;
	let tracked = 0; // offsetter.
									 // e.g: if 0.9 => 900 then it should add to the weighted_chance in the next loop
									 // so before it would be: 0.9 => 900, then 0.05 => 50 (a number like 943 wouldn't be caught)
		 							 // now it would be: 0.9 => 900, then 0.05 => 900 + 50 (a number like 930 WOULD be caught)

	const picked_number = getRandomInt(0, length);
	for (const [name, chance] of chances) {
		tracked += chance * length;
		if (tracked >= picked_number) {
			return name;
		}
	}
}

export function pickRandom<T>(iterable: T[]): T {
	return iterable[getRandomInt(0, iterable.length - 1)];
}

export function grabAllRandomWebsites(path: string): Promise<Website[]> {
	return new Promise<{ rarity: string; site: string }[]>((res) => {
		const sites: { rarity: string; site: string }[] = [];
		const readInterface = readline.createInterface({
			input: fs.createReadStream(path),
		});
		readInterface.on("line", (input) => {
			sites.push(JSON.parse(input));
		});
		readInterface.on("close", () => {
			res(sites);
		});
	});
}

export function gachaSpecificWebsite(
	websites: Website[],
	chances: [Tiers, number][]
) {
	const picked_rarity = weightedPicker(chances);
	if (!picked_rarity) {
		return;
	}

	const filtered_websites = websites.filter((v) => v.rarity === picked_rarity);
	return pickRandom(filtered_websites);
}
