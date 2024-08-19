
import {InviteData, InviteEmitters, InviteManager} from "./invite.js";
import events from "events";

type SessionEmitters = "sessionTimeout";
export type SessionMessages = "AlreadyInSession" | "CreatedSession";
export type SessionResult<K extends SessionMessages, P = NonNullable<unknown>> = { msg: K, payload: P };

export interface Player {
	id: string,
}
export interface Session {
	channel_id: string, 
	fen: string, 
	moves: string[], 
	turn_index: number,
	players: Player[],
	move_start_time: Date,
	move_end_time: Date,
}
export interface InviteNode {
	id: string,
	name: string,
	channel_id: string,
}

/**
	* Manages the lifecycle of a session.
	*/
export class SessionManager<T extends { players: { id: string }[] }, K extends { id: string }> {
	private sessions = new Map<string, T & { time_created: Date, time_end: Date }>();
	private users_in_session = new Map<string, string>; // user: session
	private event_emitter = new events.EventEmitter();
	
	constructor(private invites = new InviteManager<K>()) {}
	
	on(event: SessionEmitters, listener: (session_info: T) => void) {
		this.event_emitter.on(event, listener);
	}
	on_invite(event: InviteEmitters, listener: (info: {sender: K, recipient: K}) => void) {
		// very annoying.
		this.invites.on(event, listener);
	}

	/**
		* For checking if a user is in session.
		*/
	getUsersInSession(players: string[]): string[] {
		return players.filter(player => this.users_in_session.has(player));
	}
	/**
		* For getting the session with the user so you can modify it.
		*/
	getSessionWithUser(player: string): { hash_id: string, session: T & { time_created: Date, time_end: Date } } | undefined {
		const session_id = this.users_in_session.get(player);
		if (!session_id) {
			return undefined;
		}
		return { hash_id: session_id, session: this.sessions.get(session_id)! };
	}

	/**
		* Creates a session.
		* - IDs should be numerical due to hash method.
		* - This assumes you already checked if the users in session.
		*/
	createSession(session_info: T, ms_expiry = 30 * 60 * 1000): SessionResult<"AlreadyInSession" | "CreatedSession", { hash: string, session_info: T }> {
		const {players} = session_info;
		// check for NaN values.
		// to create a unique hash.
		const hash = rehash(players.join("-")).toString();
		for (const player of session_info.players) {
			this.users_in_session.set(player.id, hash);
		}

		const date = new Date();
		const end_date = new Date(date.getTime() + ms_expiry);

		setTimeout(() => {
			const sesh = structuredClone(session_info);
			if (this.sessions.delete(hash)) {
				for (const player of sesh.players) {
					this.users_in_session.delete(player.id);
				}
				this.event_emitter.emit("sessionTimeout", sesh);
			}
		}, ms_expiry);
		// somehow get unix time for <t:1709783400:R> discord timestamp
		// so we prolly need Date.now() to get the start and subtract the getTimeLeft fn

		this.sessions.set(hash.toString(), { time_created: date, time_end: end_date, ...session_info });

		return {msg: "CreatedSession", payload: {hash, session_info}};
	}

	/**
		* returns unix timestamp
		*/
	getTimeLeft(session_id: string): number {
		const session = this.sessions.get(session_id)!;
		// prolly works now.
		return Math.floor((session.time_end.getTime() + (session.time_created.getTime() - new Date().getTime())) / 1000);
	}

	deleteSession(session_id: string) {
		const session = structuredClone(this.sessions.get(session_id));
		if (session && this.sessions.delete(session_id)) {
				for (const player of session.players) {
					this.users_in_session.delete(player.id);
				}
				this.event_emitter.emit("sessionTimeout", session);
		}
	}
	// INVITES
	sendInviteTo(from_user: K, to_user: K, ms_expiry = 1 * 60 * 1000) {
		return this.invites.sendInviteTo(from_user, to_user, ms_expiry);
	}
	getUsers(id: string): InviteData<K> | undefined {
		return this.invites.getUserData(id);
	}
	removeInvite(sender_id: string, recipient_id: string) {
		return this.invites.removeInviteFromMemory(sender_id, recipient_id);
	}
}


/**
 * Generates 32 bit FNV-1a hash from the given string.
 * As explained here: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param s {string} String to generate hash from.
 * @param [h] {number} FNV-1a hash generation init value.
 * @returns {number} The result integer hash.
 */
export function rehash(s: string): number {
	let base = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    base ^= s.charCodeAt(i);
    base += (base << 1) + (base << 4) + (base << 7) + (base << 8) + (base << 24);
  }
  return base >>> 0;
}
