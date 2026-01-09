const dgram = require('dgram');

/**
 * Creates and starts a UDP Server with user-provided lifecycle callbacks.
 */
function createUdpServer(config) {
    const {
        host,
        port,
        init = [],
        listening = [],
        handshake = [],
        connect = [],
        receiveMessage = [],
        processMessage = [],
        respondMessage = [],
        disconnect = [],
        shutdown = [],
        error = []
    } = config;

    const activeSessions = new Set();

    // 1. [INIT]
    init.forEach(cb => cb());

    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        if (error.length > 0) {
            error.forEach(cb => cb(err));
        }
        try { server.close(); } catch (e) {}
    });

    server.on('listening', () => {
        const address = server.address();
        listening.forEach(cb => cb(address));
    });

    server.on('message', (msg, rinfo) => {
        const sessionKey = `${rinfo.address}:${rinfo.port}`;
        const isNew = !activeSessions.has(sessionKey);

        // 2. [RECEIVE]
        receiveMessage.forEach(cb => cb(msg, rinfo));

        if (isNew) {
            // 3. [HANDSHAKE]
            handshake.forEach(cb => cb(rinfo));
            // 4. [CONNECT]
            activeSessions.add(sessionKey);
            connect.forEach(cb => cb(rinfo));
        }

        // 5. [PROCESS]
        const data = msg.toString();
        processMessage.forEach(cb => cb(data, rinfo));

        // 6. [RESPOND]
        const response = Buffer.from(`ACK: ${data}`);
        server.send(response, rinfo.port, rinfo.address, (err) => {
            if (!err) respondMessage.forEach(cb => cb(response, rinfo));
        });
    });

    server.on('close', () => {
        // 7. [DISCONNECT]
        activeSessions.forEach(session => disconnect.forEach(cb => cb(session)));
        activeSessions.clear();
        // 8. [SHUTDOWN]
        shutdown.forEach(cb => cb());
    });

    server.bind(port, host);
    return server;
}

module.exports.createUdpServer = createUdpServer;

/**
 * Creates and starts a UDP Client with user-provided lifecycle callbacks.
 */
function createUdpClient(config) {
    const {
        host,
        port,
        init = [],
        listening = [],
        handshake = [],
        connect = [],
        receiveMessage = [],
        processMessage = [],
        respondMessage = [],
        disconnect = [],
        shutdown = [],
        error = []
    } = config;

    let isConnected = false;

    // 1. [INIT]
    init.forEach(cb => cb());

    const client = dgram.createSocket('udp4');

    client.on('error', (err) => {
        error.forEach(cb => cb(err));
        try { client.close(); } catch (e) {}
    });

    client.on('listening', () => {
        const address = client.address();
        listening.forEach(cb => cb(address));
    });

    client.on('message', (msg, rinfo) => {
        // 2. [RECEIVE]
        receiveMessage.forEach(cb => cb(msg, rinfo));
        // 3. [PROCESS]
        processMessage.forEach(cb => cb(msg.toString(), rinfo));
        // 4. [RESPOND]
        respondMessage.forEach(cb => cb(rinfo));
    });

    client.on('close', () => {
        // 5. [DISCONNECT]
        disconnect.forEach(cb => cb({ host, port }));
        // 6. [SHUTDOWN]
        shutdown.forEach(cb => cb());
    });

    client.sendData = (message) => {
        if (!isConnected) {
            // 7. [HANDSHAKE]
            handshake.forEach(cb => cb({ host, port }));
        }

        client.send(Buffer.from(message), port, host, (err) => {
            if (err) {
                error.forEach(cb => cb(err));
            } else if (!isConnected) {
                // 8. [CONNECT]
                isConnected = true;
                connect.forEach(cb => cb({ host, port }));
            }
        });
    };

    client.bind();
    return client;
}

module.exports.createUdpClient = createUdpClient;

