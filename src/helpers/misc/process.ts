
import {spawn, ChildProcessWithoutNullStreams} from "child_process";

/**
	* An extremely light wrapper for child process spawning.
	*/
export class Process {
	private process: ChildProcessWithoutNullStreams;
	constructor(path: string) {
		try {
			this.process = spawn(path);
		} catch (error) {
			throw new Error(`Failed to spawn engine process: ${(error as Error).message}`);
		}
	}

	async sendCommand(command: string, endSignal: RegExp): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let dataBuffer = "";

			this.process.stdin.write(command + "\n");
			const dataListener = (data:Buffer) => {
				dataBuffer += data.toString();
				if (endSignal.test(dataBuffer)) {
					this.process.stdout.off("data", dataListener);
					this.process.stdout.off("error", errorListener);
					resolve(dataBuffer);
				}
			};
			const errorListener = (err:Error) => {
				this.process.stdout.off("data", dataListener);
				this.process.stdout.off("error", errorListener);
				reject(err);
			};

			this.process.stdout.on("data", dataListener);
			this.process.stdout.once("error", errorListener);
		});
	}
}
