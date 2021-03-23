import { EventEmitter } from "events";
import { Socket } from "net";
import { Version } from "./Server";


export enum State {
	HANDSHAKE,
	RESPONSE
}

export enum Status {
	SUCCESS = 0x00,
	GENERAL_FAILURE = 0x01,
	DENY = 0x02,
	NETWORK_UNREACHABLE = 0x03,
	HOST_UNREACHABLE = 0x04,
	REFUSED = 0x05,
	TTL_EXPIRED = 0x06,
	COMMAND_NOT_SUPPORTED = 0x07,
	ADDRESS_NOT_SUPPORTED = 0x08,
	OTHER = 0xff
}

export class ClientParser extends EventEmitter {
	private listening = false;
	private state: State = State.HANDSHAKE;
	private methods: number[] = [];

	public constructor(private stream: Socket) {
		super();
	}

	public start(state: State): void {
		if (this.listening) {
			return;
		}
		this.state = state;
		this.listening = true;
		this.stream.once("data", this.onData.bind(this));
	}

	public stop(): void {
		if (!this.listening) {
			return;
		}
		this.listening = false;
		this.stream.removeListener("data", this.onData.bind(this));
	}

	private onData(chunk: Buffer): void {
		if (this.state === State.HANDSHAKE) {
			this.parseHandshake(chunk);
		} else if (this.state === State.RESPONSE) {
			this.parseResponse(chunk);
		}
	}

	private parseHandshake(chunk: Buffer) {
		let i = 0;
		const version = chunk.readUInt8(i++) as Version;
		if (version !== Version.V5) {
			this.emit("error", new Error("Incompatible SOCKS protocol version: " + version));
			return;
		}
		const method = chunk.readUInt8(i++);
		this.emit("method", method);
	}

	private parseResponse(chunk: Buffer): void {
		let i = 0;
		const version = chunk.readUInt8(i++) as Version;
		if (version !== Version.V5) {
			this.emit("error", new Error("Incompatible SOCKS protocol version: " + version));
			return;
		}

		const status = chunk.readUInt8(i++) as Status;
		i++;
		try {
			this.emit("response", status);
		} catch (e) {
			this.emit("error", e);
		}
	}
}