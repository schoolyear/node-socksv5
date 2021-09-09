import { EventEmitter } from "events";
import * as net from "net";
import ServerParser, { State } from "./ServerParser";
import Destination from "./Destination";
import { IAuth } from "./Auth";
import { Duplex } from "stream";

interface SetupIOptions {
	auths?: IAuth[];
	maxConnections?: number;
	lookupFunction?: net.LookupFunction
}

interface IOptions {
	auths: IAuth[];
	maxConnections: number;
	lookupFunction?: net.LookupFunction
}

export enum Version {
	V5 = 0x05,
}


export enum Command {
	CONNECT = 0x01,
	BIND = 0x02,
	UDP = 0x03,
}

export interface IConnectionInfo {
	command: Command;
	destination: Destination;
	source: {
		ip?: string;
		port?: number;
	};
}

export type ConnectionListener = (info: IConnectionInfo, accept: () => Promise<Duplex>, deny: () => void) => void;

export class Server extends EventEmitter {
	serverSocket: net.Server;
	protected connections = 0;
	protected options: IOptions = {
		maxConnections: Infinity,
		auths: [],
	};

	public constructor(options?: SetupIOptions, listener?: ConnectionListener) {
		super();
		if (options?.maxConnections !== undefined) {
			this.options.maxConnections = options?.maxConnections
		}
		if (options?.auths !== undefined) {
			this.options.auths = options?.auths
		}

		if (listener) {
			this.on("connection", listener);
		}

		this.serverSocket = new net.Server((socket) => {
			if (this.connections >= this.options.maxConnections) {
				socket.destroy();
			}
			this.connections++;
			socket.once("close", () => {
				this.connections--;
			});
			this.onConnection(socket);
		});

		this.init();
	}

	public useAuth(auth: IAuth): void {
		this.options.auths.push(auth);
	}

	public listen(port?: number, host?: string, listener?: () => void): void {
		this.serverSocket.listen(port, host, listener);
	}

	protected init(): void {
		this.serverSocket.on("error", (err) => {
			this.emit("error", err);
		});
		this.serverSocket.on("listening", () => {
			this.emit("listening");
		});
		this.serverSocket.on("close", () => {
			this.emit("close");
		});
	}
	protected onConnection(socket: net.Socket): void {
		const parser = new ServerParser(socket);
		parser.start(State.HANDSHAKE);
		parser.on("methods", (methods: number[]) => {
			parser.stop();
			this.onSelectMethod(socket, methods).then(() => {
				parser.start(State.REQUEST);
			}, () => {
				// noting
			});
		});
		parser.on("request", (cmd: Command, destination: Destination) => {
			parser.stop();
			this.onRequest(socket, cmd, destination).catch((err) => {
				this.emit("onRequest", err)
			});
		});
	}

	protected async onSelectMethod(socket: net.Socket, methods: number[]): Promise<void> {
		let found = false;
		for (const auth of this.options.auths) {
			if (methods.indexOf(auth.code) === -1) {
				continue;
			}
			found = true;
			socket.write(Buffer.from([Version.V5, auth.code]));
			try {
				await auth.server(socket);
				return;
			} catch (e) {
				socket.end();
				throw new Error("auth failed");
			}
		}
		if (!found) {
			socket.end(Buffer.from([Version.V5, 0xFF]));
			throw new Error("no auth method");
		}
	}

	protected async onRequest(socket: net.Socket, command: Command, destination: Destination): Promise<void> {
		if (command !== Command.CONNECT) {
			socket.end(Buffer.from([Version.V5, 0x07])); // CMDUNSUPP
			return;
		}
		const info: IConnectionInfo = {
			command: command,
			destination: destination,
			source: {
				ip: socket.remoteAddress,
				port: socket.remotePort,
			},
		};
		const accept = () => {
			return this.processConnection(socket, destination);
		};
		const deny = () => {
			if (socket.writable) {
				socket.end(Buffer.from([Version.V5, 0x02]));
			}
		};
		if (this.listenerCount("connection")) {
			this.emit("connection", info, accept, deny);
		} else {
			await accept();
		}
	}

	protected async processConnection(socket: net.Socket, destination: Destination): Promise<void> {
		return new Promise((resolve, reject) => {
			this.connect(destination).catch((err) => reject(err)).then((connection) => {
				if (!connection) { reject(); return; }

				connection.on("close", () => {
					socket.destroy();
				});
				connection.on("error", (err) => {
					this.emit("process connection", err)
					socket.destroy();
				});

				if (!socket.writable) {
					connection.destroy();
					return;
				}

				this.sendSuccessConnection(socket, destination).catch((err) => reject(err)).then(() => {
					socket.pipe(connection).pipe(socket);
					resolve();
				});

			});
		})
	}

	protected sendSuccessConnection(socket: net.Socket, destination: Destination): Promise<void> {
		return new Promise((resolve, reject) => {
			const addressBuffer = destination.toBuffer();
			const response = Buffer.alloc(3 + addressBuffer.length);
			response.writeUInt8(Version.V5);
			response.writeUInt8(0, 1);
			response.writeUInt8(0, 2);
			addressBuffer.copy(response, 3);
			socket.write(response, (err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	protected connect(address: Destination): Promise<net.Socket> {
		return new Promise((resolve, reject) => {
			const socket = new net.Socket();
			socket.on("error", reject);
			socket.connect({
				host: address.host,
				port: address.port,
				lookup: this.options.lookupFunction,
			}, () => {
				resolve(socket);
			});
		});
	}
}

export default Server;