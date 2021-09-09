import { EventEmitter } from "events";
import * as net from "net";
import { Version, Command } from "./Server";
import Destination from "./Destination";

export enum State {
	HANDSHAKE,
	REQUEST,
}

export default class ServerParser extends EventEmitter {
	private listening = false;
	private state: State = State.HANDSHAKE;
	private methods: number[] = [];

	public constructor(private stream: net.Socket) {
		super();
	}

	public start(state: State): void {
		if (this.listening) {
			return;
		}
		this.state = state;
		this.listening = true;
		this.stream.once("data", this.onData.bind(this));
		this.stream.resume();
	}

	public stop(): void {
		if (!this.listening) {
			return;
		}
		this.listening = false;
		this.stream.removeListener("data", this.onData.bind(this));
		this.stream.pause();
	}

	private onData(chunk: Buffer): void {
		if (this.state === State.HANDSHAKE) {
			this.parseHandshake(chunk);
		} else if (this.state === State.REQUEST) {
			this.parseRequest(chunk);
		}
	}

	private parseHandshake(chunk: Buffer): void {
		let i = 0;
		const version = chunk.readUInt8(i++) as Version;
		if (version !== Version.V5) {
			this.emit("error", new Error("Incompatible SOCKS protocol version: " + version));
			return;
		}
		const methodsCount = chunk.readUInt8(i++);
		if (methodsCount === 0) {
			this.emit("error", new Error("Unexpected empty methods list"));
			return;
		}
		for (let x = 0; x < methodsCount; x++) {
			this.methods.push(chunk.readUInt8(i++));
		}
		this.emit("methods", this.methods);
	}

	private parseRequest(chunk: Buffer): void {
		let i = 0;
		const version = chunk.readUInt8(i++) as Version;
		if (version !== Version.V5) {
			this.emit("error", new Error("Incompatible SOCKS protocol version: " + version));
			return;
		}

		const cmd = chunk.readUInt8(i++) as Command;
		if (cmd !== Command.CONNECT && cmd !== Command.BIND && cmd !== Command.UDP) {
			this.emit("error", new Error("Invalid request command: " + cmd));
		}

		i++;
		try {
			const destination = Destination.fromBuffer(chunk.slice(i));
			this.emit("request", cmd, destination);
		} catch (e) {
			this.emit("error", e);
		}
	}
}
