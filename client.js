const dgram = require('dgram');

/**
 * Creates and starts a UDP Client with user-provided lifecycle callbacks.
 * * @param {Object} config - The configuration object.
 * @param {string} config.host - The target server hostname or IP.
 * @param {number} config.port - The target server port.
 * @param {Array<Function>} config.init - Callbacks for initial setup.
 * @param {Array<Function>} config.listening - Callbacks for when the client is ready.
 * @param {Array<Function>} config.handshake - Callbacks for pre-connection logic.
 * @param {Array<Function>} config.connect - Callbacks for successful session start.
 * @param {Array<Function>} config.receiveMessage - Callbacks for raw incoming data.
 * @param {Array<Function>} config.processMessage - Callbacks for data processing.
 * @param {Array<Function>} config.respondMessage - Callbacks for outgoing responses.
 * @param {Array<Function>} config.disconnect - Callbacks for session termination.
 * @param {Array<Function>} config.shutdown - Callbacks for resource cleanup.
 * @param {Array<Function>} config.error - Callbacks for error handling.
 */
function createUdpClient(config) {
    // Destructure all configurations
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

    // Internal state management
    let isConnected = false;

    // 1. [INIT] Lifecycle
    if (init && Array.isArray(init)) {
        init.forEach(cb => cb());
    }

    // Create the UDP socket
    const client = dgram.createSocket('udp4');

    // 2. [ERROR] Lifecycle
    client.on('error', (err) => {
        if (error && Array.isArray(error)) {
            error.forEach(cb => cb(err));
        }
        client.close();
    });

    // 3. [LISTENING] Lifecycle
    client.on('listening', () => {
        const address = client.address();
        if (listening && Array.isArray(listening)) {
            listening.forEach(cb => cb(address));
        }
    });

    // 4. [RECEIVE / PROCESS / RESPOND] Lifecycle
    client.on('message', (msg, rinfo) => {
        // Receive
        if (receiveMessage && Array.isArray(receiveMessage)) {
            receiveMessage.forEach(cb => cb(msg, rinfo));
        }

        // Process
        const processedData = msg.toString();
        if (processMessage && Array.isArray(processMessage)) {
            processMessage.forEach(cb => cb(processedData, rinfo));
        }

        // Respond (Client-side acknowledgment if necessary)
        if (respondMessage && Array.isArray(respondMessage)) {
            respondMessage.forEach(cb => cb(rinfo));
        }
    });

    // 5. [DISCONNECT / SHUTDOWN] Lifecycle
    client.on('close', () => {
        if (disconnect && Array.isArray(disconnect)) {
            disconnect.forEach(cb => cb({ host, port }));
        }
        if (shutdown && Array.isArray(shutdown)) {
            shutdown.forEach(cb => cb());
        }
    });

    /**
     * Enhanced send method to handle Handshake and Connect logic
     */
    client.sendData = (message) => {
        const messageBuffer = Buffer.from(message);

        // 6. [HANDSHAKE] Lifecycle (Simulated)
        if (!isConnected && handshake && Array.isArray(handshake)) {
            handshake.forEach(cb => cb({ host, port }));
        }

        client.send(messageBuffer, port, host, (err) => {
            if (err) {
                if (error && Array.isArray(error)) error.forEach(cb => cb(err));
            } else if (!isConnected) {
                // 7. [CONNECT] Lifecycle
                isConnected = true;
                if (connect && Array.isArray(connect)) {
                    connect.forEach(cb => cb({ host, port }));
                }
            }
        });
    };

    // Auto-bind to a random port to enable 'listening'
    client.bind();

    return client;
}

// --- Example Usage ---

const myConfig = {
    host: '127.0.0.1',
    port: 41234,
    init: [() => console.log("System initializing...")],
    listening: [(addr) => console.log(`Client listening on port ${addr.port}`)],
    handshake: [(target) => console.log(`Performing handshake with ${target.host}...`)],
    connect: [(target) => console.log(`Connected to ${target.host}:${target.port}`)],
    receiveMessage: [(msg) => console.log(`Raw message received: ${msg.length} bytes`)],
    processMessage: [(data) => console.log(`Processing server response: ${data}`)],
    respondMessage: [(rinfo) => console.log(`Acknowledging receipt to ${rinfo.address}`)],
    disconnect: [(target) => console.log(`Disconnected from ${target.host}`)],
    shutdown: [() => console.log("Client resources fully released.")],
    error: [(err) => console.error(`Error: ${err.message}`)]
};

const clientInstance = createUdpClient(myConfig);

// Send a test message
setTimeout(() => {
    clientInstance.sendData("Hello Server");
}, 2000);

// // Close the client after some time
// setTimeout(() => {
//     clientInstance.close();
// }, 6000);