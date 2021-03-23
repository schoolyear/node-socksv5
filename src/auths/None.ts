import { IAuth } from "../Auth";

export default class None implements IAuth {
	public readonly code = 0x00;
	public server(): Promise<void> {
		return Promise.resolve();
	}
	public client(): Promise<void> {
		return Promise.resolve();
	}
}