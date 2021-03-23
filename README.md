Description
===========

SOCKS protocol version 5 server and client implementations for node.js


Requirements
============
Tested on 
* [node.js](http://nodejs.org/) -- v12.20.1


Install
=======

    npm install node-socksv5


Examples
========

* Server with no authentication and allowing all connections:

```typescript
import {Server, Auth} from "node-socksv5";

const srv = new Server();
srv.listen(1080, 'localhost', () => {
	console.log('SOCKS server listening on port 1080');
});
srv.useAuth(Auth.none());
```

* Server with username/password authentication and allowing all (authenticated) connections:

```typescript
import {Server, Auth} from "node-socksv5";

const srv = new Server();
srv.listen(1080, 'localhost', () => {
	console.log('SOCKS server listening on port 1080');
});
srv.useAuth(srv.useAuth(Auth.userPass((username, password) => {
	if (username === 'nodejs' && password === 'rules!') {
		return Promise.resolve();
	} else {
		return Promise.reject();
	}
}));
```

* Server with no authentication and denying all connections not made to port 80:

```typescript
import {Server, Auth} from "node-socksv5";

const srv = new Server({}, (info, accept, deny) => {
  if (info.destination.port === 80) {
    accept();
  } else {
    deny();
  }
});
srv.listen(1080, 'localhost', () => {
	console.log('SOCKS server listening on port 1080');
});
srv.useAuth(Auth.none());
```

* Server with no authentication, intercepting all connections to port 80, and passing through all others:

```typescript
import {Server, Auth} from "node-socksv5";

const srv = new Server({}, (info, accept, deny) => {
  if (info.destination.port === 80) {
		const socket = await accept();
		var body = 'Hello ' + info.source.ip + '!\n\nToday is: ' + (new Date());
		socket.end([
			'HTTP/1.1 200 OK',
			'Connection: close',
			'Content-Type: text/plain',
			'Content-Length: ' + Buffer.byteLength(body),
			'',
			body
		].join('\r\n'));
	} else {
		accept();
	}
});
srv.listen(1080, 'localhost', () => {
	console.log('SOCKS server listening on port 1080');
});
srv.useAuth(Auth.none());
```

* Client with no authentication:

```typescript
import {Client, Auth} from "node-socksv5";

const client = new Client({
	proxy: {
		host: "127.0.0.1",
		port: 1080,
	},
	destination: {
		host: "google.com",
		port: 80,
	},
	auths: [ Auth.none() ],
}, (socket) => {
	console.log('>> Connection successful');
	socket.write('GET /node.js/rules HTTP/1.0\r\n\r\n');
	socket.pipe(process.stdout);
});
```
