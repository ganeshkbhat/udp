const dgram = require('dgram');

/**
 * Enhanced Stateful UDP Server
 * Includes simulated lifecycle hooks for connection-oriented behavior.
 */
function createUdpServer(config) {
    const {
        host,
        port,
        init,
        listening,
        handshake,
        connect,
        receiveMessage,
        processMessage,
        respondMessage,
        disconnect,
        shutdown,
        error
    } = config;

    // Internal state to track "connections" (sessions)
    const activeSessions = new Set();

    // 1. Init Lifecycle
    init.forEach(cb => cb());

    const server = dgram.createSocket('udp4');

    // Lifecycle: Error
    server.on('error', (err) => {
        error.forEach(cb => cb(err));
        server.close();
    });

    // Lifecycle: Listening
    server.on('listening', () => {
        const address = server.address();
        listening.forEach(cb => cb(address));
    });

    // Lifecycle: Message (Handles Receive, Handshake, Connect, Process, and Respond)
    server.on('message', (msg, rinfo) => {
        const sessionKey = `${rinfo.address}:${rinfo.port}`;
        const isNewConnection = !activeSessions.has(sessionKey);

        // 2. Receive Message Lifecycle
        receiveMessage.forEach(cb => cb(msg, rinfo));

        if (isNewConnection) {
            // 3. Handshake Lifecycle (Simulated validation)
            handshake.forEach(cb => cb(rinfo));

            // 4. Connect Lifecycle
            activeSessions.add(sessionKey);
            connect.forEach(cb => cb(rinfo));
        }

        // 5. Process Message Lifecycle
        const processedData = msg.toString().toUpperCase(); // Example processing
        processMessage.forEach(cb => cb(processedData, rinfo));

        // 6. Respond Message Lifecycle
        const response = Buffer.from(`ACK: ${processedData}`);
        server.send(response, rinfo.port, rinfo.address, (err) => {
            if (!err) {
                respondMessage.forEach(cb => cb(response, rinfo));
            }
        });
    });

    // Lifecycle: Close (Maps to Shutdown and Disconnect)
    server.on('close', () => {
        // 7. Disconnect Lifecycle
        // In this simulation, we clear all sessions on server close
        activeSessions.forEach(session => {
            disconnect.forEach(cb => cb(session));
        });
        activeSessions.clear();

        // 8. Shutdown Lifecycle
        shutdown.forEach(cb => cb());
    });

    // Bind the server
    server.bind(port, host);

    return server;
}

// --- Implementation Example ---

const serverCallbacks = {
    init: [() => console.log("[INIT] Initializing resources...")],
    listening: [(addr) => console.log(`[LISTENING] Server at ${addr.address}:${addr.port}`)],
    handshake: [(rinfo) => console.log(`[HANDSHAKE] Validating client ${rinfo.address}`)],
    connect: [(rinfo) => console.log(`[CONNECT] New session: ${rinfo.address}:${rinfo.port}`)],
    receiveMessage: [(msg) => console.log(`[RECEIVE] Raw data: ${msg.length} bytes`)],
    processMessage: [(data) => console.log(`[PROCESS] Transforming data to: ${data}`)],
    respondMessage: [(res) => console.log(`[RESPOND] Acknowledgment sent`)],
    disconnect: [(session) => console.log(`[DISCONNECT] Session ended for ${session}`)],
    shutdown: [() => console.log("[SHUTDOWN] Server resources cleaned up.")],
    error: [(err) => console.error(`[ERROR] ${err.message}`)]
};

const myServer = createUdpServer({
    host: '127.0.0.1',
    port: 41234,
    ...serverCallbacks
});

// To trigger Disconnect and Shutdown, call:
// setTimeout(() => myServer.close(), 10000);