import { isIPv4, isIPv6 } from "net";

export enum AddressType {
	IPv4 = 0x01,
	Name = 0x03,
	IPv6 = 0x04,
}


export default class Destination {
	public static fromBuffer(buffer: Buffer): Destination {
		let i = 0;
		let address: string;
		const addressType = buffer.readUInt8(i++) as AddressType;
		if (addressType === AddressType.IPv4) {
			address = buffer.readUInt8(i++) + "." + buffer.readUInt8(i++) + "." + buffer.readUInt8(i++) + "." + buffer.readUInt8(i++);
		} else if (addressType === AddressType.Name) {
			const length = buffer.readUInt8(i++);
			address = buffer.slice(i, i += length).toString("utf-8");
		} else if (addressType === AddressType.IPv6) {
			address = "";
			for (let x = 0; x < 16; x++) {
				if (x % 2 === 0 && x > 0) {
					address += ":";
				}
				address += (buffer[i + x] < 16 ? "0" : "") + buffer[i + x].toString(16);
			}
		} else {
			throw new Error("Invalid request address type: " + addressType);
		}
		const port = buffer.readUInt16BE(i);
		return new Destination(addressType, address, port);
	}

	public static getAddressType(host: string): AddressType {
		if (isIPv4(host)) {
			return AddressType.IPv4;
		} else if (isIPv6(host)) {
			return AddressType.IPv6;
		}
		return AddressType.Name;
	}

	public constructor(public type: AddressType, public host: string, public port: number) {
	}

	public toBuffer(): Buffer {
		let i = 0;
		let length = 1 + 2;
		if (this.type === AddressType.IPv4) {
			length += 4;
		} else if (this.type === AddressType.IPv6) {
			length += 16;
		} else if (this.type === AddressType.Name) {
			length += 1 + this.host.length;
		}
		const buffer = Buffer.alloc(length);
		buffer.writeUInt8(this.type, i++);
		if (this.type === AddressType.IPv4) {
			const segments = this.host.split(".");
			for (const seg of segments) {
				buffer.writeUInt8(parseInt(seg, 10), i++);
			}
		} else if (this.type === AddressType.Name) {
			buffer.writeUInt8(this.host.length, i++);
			buffer.write(this.host, i);
			i += this.host.length;
		} else if (this.type === AddressType.IPv6) {
			const segments = this.host.split(":");
			for (const seg of segments) {
				buffer.writeUInt16LE(parseInt(seg, 16), i);
				i += 2;
			}
		}
		buffer.writeUInt16BE(this.port, i);
		return buffer;
	}
}