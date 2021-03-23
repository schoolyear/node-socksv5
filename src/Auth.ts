import { Socket } from "net";
import None from "./auths/None";
import UserPassword, { VerifyPasswordCallback, AskPasswordCallback } from "./auths/UserPassword";

export interface IAuth {
	readonly code: number;
	server(socket: Socket): Promise<void>;
	client(socket: Socket): Promise<void>;
}

export class Auth {

	public static none(): None {
		return new None();
	}

	public static userPass(callback: VerifyPasswordCallback | AskPasswordCallback): UserPassword {
		return new UserPassword(callback);
	}
}

export default Auth;