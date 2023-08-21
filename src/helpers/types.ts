import Pocketbase from "pocketbase"
import { Client, Message, Collection } from "discord.js";

export type CommandModule = { 
    name:         string,
    description?: string,
    cooldown:     number,
    execute: (
        client:    Client, 
        msg:       Message, 
        args:      string[],
        deps:      ExternalDependencies,
    ) => void,
    dyn_cooldown?: (args: string[])               => Promise<number>,
    checker?:      (msg: Message, args: string[]) => Promise<boolean>,
    special?:      boolean,
};

export type ExternalDependencies = {
    pb: Pocketbase,
    commands: Collection<string, CommandModule>,
    prefix:   string,
}