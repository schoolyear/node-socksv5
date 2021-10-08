import { Server} from './Server';
import { Auth } from './Auth';

export function SetupProxy(): Server {
    let dnsCache = new Map();
    return new Server(
        {
        },
        (info, accept, deny) => {
            accept();
        },
    );
}

export function StartProxy(srv: Server): Promise<void> {
    // no login auth is required as this proxy is bound to localhost
    srv.useAuth(Auth.none());

    // wrap the callback in a promise
    const listen = (port, hostname) => {
        return new Promise<void>((resolve, reject) => {
            srv.listen(port, hostname, () => {
                resolve();
            });
        });
    };

    return listen(8080, 'localhost');
}
