import { Socket } from "net";
import { IAuth } from "../Auth";

export type VerifyPasswordCallback = (username: string, password: string) => Promise<void>;
export type AskPasswordCallback = () => Promise<{username: string; password: string}>;

export default class UserPassword implements IAuth {
	public readonly code = 0x02;
	public readonly version = 0x01;

	public constructor(protected callback: VerifyPasswordCallback | AskPasswordCallback) {}

	public server(socket: Socket): Promise<void> {
		const onData = (buffer: Buffer): Promise<void> => {
			let i = 0;
			const version = buffer.readUInt8(i++);
			if (version !== this.version) {
				throw new Error("unsupported version: " + version);
			}

			const usernameLength = buffer.readUInt8(i++);
			const username = buffer.slice(i, i += usernameLength).toString();

			const passwordLength = buffer.readUInt8(i++);
			const password = buffer.slice(i, i += passwordLength).toString();

			return (this.callback as VerifyPasswordCallback)(username, password);
		};
		return new Promise((resolve, reject) => {
			socket.once("data", (buffer) => {
				onData(buffer).then(() => {
					socket.write(Buffer.from([this.version, 0x00]));
					resolve();
				}, () => {
					socket.write(Buffer.from([this.version, 0x01]));
					reject();
				});
			});
		});
	}

	public async client(socket: Socket): Promise<void> {
		const onData = async (data: Buffer): Promise<void> => {
			let i = 0;
			const version = data.readUInt8(i++);
			if (version !== this.version) {
				throw new Error("unsupported version: " + version);
			}
			const result = data.readUInt8(i++);
			if (result !== 0x00) {
				throw result;
			}
		};
		const sendAuth = async () => {
			const { username, password } = await (this.callback as AskPasswordCallback)();
			let i = 0;
			const authBuffer = Buffer.alloc(1 + 1 + username.length + 1 + password.length);
			authBuffer.writeUInt8(this.version, i++);
			authBuffer.writeUInt8(username.length, i++);
			authBuffer.write(username, i);
			i += username.length;
			authBuffer.writeUInt8(password.length, i++);
			authBuffer.write(password, i);
			socket.write(authBuffer);
		};
		return new Promise((resolve, reject) => {
			socket.once("data", (data) => {
				onData(data).then(resolve, reject);
			});
			sendAuth();
		});
	}
}