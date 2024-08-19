// wrapper for the entire helper folder.

import { quoteDefault } from "./quote/default.js";

import { importDirectories, postProcessAliases } from "./misc/import.js";
import { completePartialMessage } from "./misc/fetch.js";
import { checkIfLink } from "./misc/link.js";
import { pingURL } from "./misc/ping.js";
import {
	pickRandom,
	getRandomInt,
	grabAllRandomWebsites,
	gachaSpecificWebsite,
} from "./misc/random.js";
import { formatArray } from "./misc/smartjoin.js";
import { Queue } from "./misc/queue.js";

import {
	CommandModule as Command,
	ExternalDependencies as Ext,
	Cooldown as Cool,
	JSONObject as JSONO,
	Tiers as Ti,
	Website as Webs,
} from "./types.js";

const mod = {
	quoteDefault,

	importDirectories,
	postProcessAliases,
	checkIfLink,

	pingURL,
	getRandomInt,
	grabAllRandomWebsites,
	formatArray,
	gachaSpecificWebsite,

	completePartialMessage,
	pickRandom,
	Queue,
};

export type CommandModule = Command;
export type ExternalDependencies = Ext;
export type Cooldown = Cool;
export type JSONObject = JSONO;
export type Tiers = Ti;
export type Website = Webs;

export default mod;
