
import events from "events";
import {rehash} from "./session.js";

export type InviteEmitters = "inviteTimeout";
export type InviteMessages = "AddInvite" | "RemovedInvite" | "NoInvites" | "HasInvite";
export type InviteResult<K extends InviteMessages, P = NonNullable<unknown>> = { msg: K, payload: P };
export interface InviteData<T> {
	recipient: T;
	sender: T;
}

export class InviteManager<T extends {id: string}> {
	private invite_map = new Map<string, InviteData<T>>();
	private event_emitter = new events.EventEmitter();

	constructor() {}
	on(event: InviteEmitters, listener: (info: {sender: T, recipient: T}) => void) {
		this.event_emitter.on(event, listener);
	}

	sendInviteTo(from_user: T, to_user: T, expiry_in_ms = 1 * 60 * 1000): InviteResult<"AddInvite" | "HasInvite"> {
		// it implicitly allows multiple senders and recievers too. damn.
		const invite_hash = rehash(`${from_user.id}${to_user.id}`).toString();
		const already_invited = this.invite_map.has(invite_hash);
		if (already_invited) {
			return {msg: "HasInvite", payload: {}};
		}
		this.invite_map.set(invite_hash, {
			recipient: from_user,
			sender: to_user,
		});
		setTimeout(() => {
			if (this.invite_map.delete(invite_hash)) {
				this.event_emitter.emit("inviteTimeout", {from_user, to_user});
			}
		}, expiry_in_ms);
		return {msg: "AddInvite", payload: {}};
	}
	/**
		* Can be used to accept, reject, or revoke an invite.
		* It just removes the invite from the internal invite map.
		*/
	removeInviteFromMemory(sender_id: string, recipient_id: string): InviteResult<"RemovedInvite" | "NoInvites", {sender: T, reciever: T} | undefined> {
		// sender and recipient? ??chess accept @ping then?
		const invite_hash = rehash(`${sender_id}${recipient_id}`).toString();
		const invite = this.invite_map.get(invite_hash);
		if (!invite) {
			return {msg: "NoInvites", payload: undefined};
		}
		const sender = structuredClone(invite.sender);
		const reciever = structuredClone(invite.recipient);
		this.invite_map.delete(invite_hash);
		return {msg: "RemovedInvite", payload: {sender, reciever}};
	}

	printAllVariables(): string {
		return "invites: " + JSON.stringify(this.invite_map, replacer, 4) + this.invite_map.size + "\n";
	}
	getUserData(id: string): InviteData<T> | undefined {
		return this.invite_map.get(id);
	}
}

function replacer(key: string, value: unknown) {
	if (value instanceof Map) {
		return {
			dataType: "Map",
			value: Array.from(value.entries()),
		};
	} else {
		return value;
	}
}
