import { EventEmitter } from "events";
import { Socket } from "net";
import * as stream from "stream";
import { IAuth } from "./Auth";
import { ClientParser, State, Status } from "./ClientParser";
import Destination from "./Destination";
import { Command, Version } from "./Server";

export interface IOptions {
	proxy: {
		host: string;
		port: number;
	} | Destination;
	destination: {
		host: string;
		port: number;
	} | Destination;
	auths?: IAuth[];
}

export class Client extends EventEmitter {
	protected socket: Socket;

	public constructor(protected options: IOptions, callback?: (stream: stream.Duplex) => void) {
		super();
		if (options.auths === undefined) {
			options.auths = [];
		}
		if (callback) {
			this.on("connect", callback);
		}
		this.connect();
	}

	public useAuth(auth: IAuth): void {
		this.options.auths.push(auth);
	}

	protected connect(): void {
		this.socket = new Socket();
		this.socket.on("connect", () => this.onConnect());
		this.socket.on("error", (err) => this.emit("error", err));
		this.socket.on("close", (err) => this.emit("close", err));
		this.socket.connect(this.options.proxy.port, this.options.proxy.host);
	}

	protected sendHandshake(): void {
		let i = 0;
		const handshake = Buffer.alloc(1 + 1 + this.options.auths.length);
		handshake.writeUInt8(Version.V5, i++);
		handshake.writeUInt8(this.options.auths.length, i++);
		for (const auth of this.options.auths) {
			handshake.writeUInt8(auth.code, i++);
		}
		this.socket.write(handshake);
	}

	protected sendRequest(): void {
		let destination: Destination;
		if (this.options.destination instanceof Destination) {
			destination = this.options.destination;
		} else {
			destination = new Destination(Destination.getAddressType(this.options.destination.host), this.options.destination.host, this.options.destination.port);
		}
		const destinationBuffer = destination.toBuffer();

		let i = 0;
		const request = Buffer.alloc(1 + 1 + 1 + destinationBuffer.length);
		request.writeUInt8(Version.V5, i++);
		request.writeUInt8(Command.CONNECT, i++);
		request.writeUInt8(0x00, i++);
		destinationBuffer.copy(request, i);

		this.socket.write(request);
	}

	protected onConnect(): void {
		const parser = new ClientParser(this.socket);
		parser.on("method", (method) => {
			parser.stop();
			this.onSelectMethod(method).then(() => {
				parser.start(State.RESPONSE);
				this.sendRequest();
			}, (err) => {
				this.emit("error", err);
				this.socket.end();
			});
		});
		parser.on("response", (status: Status) => {
			parser.stop();
			this.onResponse(status).then((stream) => {
				this.emit("connect", stream);
			}, (err) => {
				this.emit("error", err);
				this.socket.end();
			});
		});
		parser.start(State.HANDSHAKE);
		this.sendHandshake();
	}

	protected async onSelectMethod(method: number): Promise<void> {
		let selectedAuth: IAuth = undefined;
		for (const auth of this.options.auths) {
			if (auth.code === method) {
				selectedAuth = auth;
				break;
			}
		}
		if (!selectedAuth) {
			throw new Error("no authentication method");
		}
		return selectedAuth.client(this.socket);
	}

	protected async onResponse(status: Status): Promise<stream.Duplex> {
		if (status !== Status.SUCCESS) {
			throw new Error("request response: " + status);
		}
		return this.socket;
	}
}

export default Client;