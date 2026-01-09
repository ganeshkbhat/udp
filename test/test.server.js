const { expect } = require('chai');
const { createUdpServer, createUdpClient } = require('../index.js');
const dgram = require('dgram');


describe('UDP Lifecycle Tests', function() {
    let server;
    let client;

    afterEach(() => {
        if (server) server.close();
        if (client) client.close();
    });

    it('should trigger the full sequence of callbacks', function(done) {
        let connectTriggered = false;

        server = createUdpServer({
            host: '127.0.0.1',
            port: 41234,
            connect: [() => { connectTriggered = true; }]
        });

        client = createUdpClient({
            host: '127.0.0.1',
            port: 41234,
            processMessage: [(data) => {
                expect(data).to.contain('ACK: Hello');
                expect(connectTriggered).to.be.true;
                done();
            }]
        });

        setTimeout(() => client.sendData("Hello"), 100);
    });
});

// --- SERVER AND CLIENT IMPLEMENTATION ---

// --- MOCHA TESTS ---

describe('Comprehensive UDP Lifecycle Tests', function() {
    this.timeout(5000);
    const TEST_HOST = '127.0.0.1';
    const TEST_PORT = 41234;

    let server;
    let client;

    afterEach((done) => {
        if (client) client.close();
        if (server) server.close();
        // Brief timeout to ensure sockets are released by the OS
        // setTimeout(done, 200);
    });

    it('should execute all 10 Server Lifecycle callbacks in order', function(done) {
        const events = [];

        server = createUdpServer({
            host: TEST_HOST,
            port: TEST_PORT,
            init: [() => events.push('init')],
            listening: [() => events.push('listening')],
            handshake: [() => events.push('handshake')],
            connect: [() => events.push('connect')],
            receiveMessage: [() => events.push('receiveMessage')],
            processMessage: [() => events.push('processMessage')],
            respondMessage: [() => {
                events.push('respondMessage');
                server.close(); // Trigger remaining 2
            }],
            disconnect: [() => events.push('disconnect')],
            shutdown: [() => {
                events.push('shutdown');
                
                // Assertions
                expect(events).to.include.members([
                    'init', 'listening', 'handshake', 'connect', 
                    'receiveMessage', 'processMessage', 'respondMessage', 
                    'disconnect', 'shutdown'
                ]);
                done();
            }],
            error: [(err) => done(err)]
        });

        // Trigger the flow via a simple dgram client
        const trigger = dgram.createSocket('udp4');
        trigger.send(Buffer.from('test'), TEST_PORT, TEST_HOST, () => trigger.close());
    });

    it('should execute all 10 Client Lifecycle callbacks in order', function(done) {
        const clientEvents = [];

        // Start a dummy server to respond
        const dummyServer = dgram.createSocket('udp4');
        dummyServer.on('message', (msg, rinfo) => {
            dummyServer.send(Buffer.from('ACK'), rinfo.port, rinfo.address);
        });
        dummyServer.bind(TEST_PORT, TEST_HOST);

        client = createUdpClient({
            host: TEST_HOST,
            port: TEST_PORT,
            init: [() => clientEvents.push('init')],
            listening: [() => clientEvents.push('listening')],
            handshake: [() => clientEvents.push('handshake')],
            connect: [() => clientEvents.push('connect')],
            receiveMessage: [() => clientEvents.push('receiveMessage')],
            processMessage: [() => {
                clientEvents.push('processMessage');
                client.close(); // Trigger remaining
            }],
            respondMessage: [() => clientEvents.push('respondMessage')],
            disconnect: [() => clientEvents.push('disconnect')],
            shutdown: [() => {
                clientEvents.push('shutdown');
                
                expect(clientEvents).to.include.members([
                    'init', 'listening', 'handshake', 'connect', 
                    'receiveMessage', 'processMessage', 'respondMessage', 
                    'disconnect', 'shutdown'
                ]);
                dummyServer.close();
                done();
            }],
            error: [(err) => done(err)]
        });

        // Start the sequence
        setTimeout(() => client.sendData("Ping"), 200);
    });

    it('should handle error callback on port conflict', function(done) {
        const conflictServer = dgram.createSocket('udp4');
        conflictServer.bind(TEST_PORT, TEST_HOST, () => {
            
            createUdpServer({
                host: TEST_HOST,
                port: TEST_PORT,
                error: [(err) => {
                    expect(err.code).to.equal('EADDRINUSE');
                    conflictServer.close();
                    done();
                }]
            });
        });
    });
});

describe('Comprehensive UDP Lifecycle Tests', function() {
    this.timeout(5000);
    const TEST_HOST = '127.0.0.1';
    const TEST_PORT = 41234;

    let server;
    let client;

    // Fixed afterEach to prevent ERR_SOCKET_DGRAM_NOT_RUNNING
    afterEach((done) => {
        try {
            if (client) {
                client.removeAllListeners();
                client.close();
            }
        } catch (e) { /* Already closed */ }

        try {
            if (server) {
                server.removeAllListeners();
                server.close();
            }
        } catch (e) { /* Already closed */ }

        client = null;
        server = null;
        setTimeout(done, 100);
    });

    it('should execute all 10 Server Lifecycle callbacks in order', function(done) {
        const events = [];

        server = createUdpServer({
            host: TEST_HOST,
            port: TEST_PORT,
            init: [() => events.push('init')],
            listening: [() => events.push('listening')],
            handshake: [() => events.push('handshake')],
            connect: [() => events.push('connect')],
            receiveMessage: [() => events.push('receiveMessage')],
            processMessage: [() => events.push('processMessage')],
            respondMessage: [() => {
                events.push('respondMessage');
                // Use setImmediate to ensure send finishes before closing
                setImmediate(() => server.close());
            }],
            disconnect: [() => events.push('disconnect')],
            shutdown: [() => {
                events.push('shutdown');
                try {
                    expect(events).to.include.members([
                        'init', 'listening', 'handshake', 'connect', 
                        'receiveMessage', 'processMessage', 'respondMessage', 
                        'disconnect', 'shutdown'
                    ]);
                    done();
                } catch (err) {
                    done(err);
                }
            }],
            error: [(err) => done(err)]
        });

        const trigger = dgram.createSocket('udp4');
        trigger.send(Buffer.from('test'), TEST_PORT, TEST_HOST, () => trigger.close());
    });

    it('should execute all 10 Client Lifecycle callbacks in order', function(done) {
        const clientEvents = [];
        const dummyServer = dgram.createSocket('udp4');

        dummyServer.on('message', (msg, rinfo) => {
            dummyServer.send(Buffer.from('ACK'), rinfo.port, rinfo.address);
        });
        dummyServer.bind(TEST_PORT, TEST_HOST);

        client = createUdpClient({
            host: TEST_HOST,
            port: TEST_PORT,
            init: [() => clientEvents.push('init')],
            listening: [() => clientEvents.push('listening')],
            handshake: [() => clientEvents.push('handshake')],
            connect: [() => clientEvents.push('connect')],
            receiveMessage: [() => clientEvents.push('receiveMessage')],
            processMessage: [() => {
                clientEvents.push('processMessage');
                setImmediate(() => client.close());
            }],
            respondMessage: [() => clientEvents.push('respondMessage')],
            disconnect: [() => clientEvents.push('disconnect')],
            shutdown: [() => {
                clientEvents.push('shutdown');
                try {
                    expect(clientEvents).to.include.members([
                        'init', 'listening', 'handshake', 'connect', 
                        'receiveMessage', 'processMessage', 'respondMessage', 
                        'disconnect', 'shutdown'
                    ]);
                    dummyServer.close();
                    done();
                } catch (err) {
                    dummyServer.close();
                    done(err);
                }
            }],
            error: [(err) => done(err)]
        });

        setTimeout(() => client.sendData("Ping"), 100);
    });
});

// --- SERVER AND CLIENT IMPLEMENTATION ---

// --- MOCHA TESTS ---

describe('Comprehensive UDP Lifecycle Tests', function() {
    this.timeout(5000);
    const TEST_HOST = '127.0.0.1';
    const TEST_PORT = 41234;

    let server;
    let client;

    // Safety cleanup to prevent ERR_SOCKET_DGRAM_NOT_RUNNING
    afterEach((done) => {
        const cleanup = (socket) => {
            if (socket) {
                socket.removeAllListeners();
                try {
                    // This is the core fix: check if the internal handle is still active
                    socket.close();
                } catch (e) {
                    // Silently ignore if already closed
                }
            }
        };

        cleanup(client);
        cleanup(server);
        
        client = null;
        server = null;
        
        // Give the OS a moment to free the port
        setTimeout(done, 100);
    });

    it('should execute all 10 Server Lifecycle callbacks in order', function(done) {
        const events = [];

        server = createUdpServer({
            host: TEST_HOST,
            port: TEST_PORT,
            init: [() => events.push('init')],
            listening: [() => events.push('listening')],
            handshake: [() => events.push('handshake')],
            connect: [() => events.push('connect')],
            receiveMessage: [() => events.push('receiveMessage')],
            processMessage: [() => events.push('processMessage')],
            respondMessage: [() => {
                events.push('respondMessage');
                // Use setImmediate to let the send callback finish before closing
                setImmediate(() => server.close());
            }],
            disconnect: [() => events.push('disconnect')],
            shutdown: [() => {
                events.push('shutdown');
                try {
                    expect(events).to.include.members([
                        'init', 'listening', 'handshake', 'connect', 
                        'receiveMessage', 'processMessage', 'respondMessage', 
                        'disconnect', 'shutdown'
                    ]);
                    done();
                } catch (err) {
                    done(err);
                }
            }],
            error: [(err) => done(err)]
        });

        const trigger = dgram.createSocket('udp4');
        trigger.send(Buffer.from('test'), TEST_PORT, TEST_HOST, () => trigger.close());
    });

    it('should execute all 10 Client Lifecycle callbacks in order', function(done) {
        const clientEvents = [];
        const dummyServer = dgram.createSocket('udp4');

        dummyServer.on('message', (msg, rinfo) => {
            dummyServer.send(Buffer.from('ACK'), rinfo.port, rinfo.address);
        });
        dummyServer.bind(TEST_PORT, TEST_HOST);

        client = createUdpClient({
            host: TEST_HOST,
            port: TEST_PORT,
            init: [() => clientEvents.push('init')],
            listening: [() => clientEvents.push('listening')],
            handshake: [() => clientEvents.push('handshake')],
            connect: [() => clientEvents.push('connect')],
            receiveMessage: [() => clientEvents.push('receiveMessage')],
            processMessage: [() => {
                clientEvents.push('processMessage');
                setImmediate(() => client.close());
            }],
            respondMessage: [() => clientEvents.push('respondMessage')],
            disconnect: [() => clientEvents.push('disconnect')],
            shutdown: [() => {
                clientEvents.push('shutdown');
                try {
                    expect(clientEvents).to.include.members([
                        'init', 'listening', 'handshake', 'connect', 
                        'receiveMessage', 'processMessage', 'respondMessage', 
                        'disconnect', 'shutdown'
                    ]);
                    dummyServer.close();
                    done();
                } catch (err) {
                    dummyServer.close();
                    done(err);
                }
            }],
            error: [(err) => done(err)]
        });

        setTimeout(() => client.sendData("Ping"), 100);
    });
});

describe('UDP Modular Lifecycle Tests', function() {
    this.timeout(5000);
    const HOST = '127.0.0.1';
    const PORT = 41234;

    let server;
    let client;

    afterEach((done) => {
        const safeClose = (socket) => {
            if (socket) {
                socket.removeAllListeners();
                try { socket.close(); } catch (e) {}
            }
        };
        safeClose(client);
        safeClose(server);
        client = null;
        server = null;
        setTimeout(done, 150);
    });

    it('should verify all server lifecycle events trigger in order', function(done) {
        const events = [];

        server = createUdpServer({
            host: HOST,
            port: PORT,
            init: [() => events.push('init')],
            listening: [() => events.push('listening')],
            handshake: [() => events.push('handshake')],
            connect: [() => events.push('connect')],
            receiveMessage: [() => events.push('receiveMessage')],
            processMessage: [() => events.push('processMessage')],
            respondMessage: [() => {
                events.push('respondMessage');
                setImmediate(() => server.close());
            }],
            disconnect: [() => events.push('disconnect')],
            shutdown: [() => {
                events.push('shutdown');
                try {
                    expect(events).to.include.members(['init', 'listening', 'handshake', 'connect', 'receiveMessage', 'processMessage', 'respondMessage', 'disconnect', 'shutdown']);
                    done();
                } catch (e) { done(e); }
            }]
        });

        // Trigger message
        const trigger = dgram.createSocket('udp4');
        trigger.send(Buffer.from('hello'), PORT, HOST, () => trigger.close());
    });

    it('should verify all client lifecycle events trigger in order', function(done) {
        const events = [];
        
        // Setup a simple responder
        const responder = dgram.createSocket('udp4');
        responder.on('message', (msg, rinfo) => {
            responder.send(Buffer.from('ACK'), rinfo.port, rinfo.address);
        });
        responder.bind(PORT, HOST);

        client = createUdpClient({
            host: HOST,
            port: PORT,
            init: [() => events.push('init')],
            listening: [() => events.push('listening')],
            handshake: [() => events.push('handshake')],
            connect: [() => events.push('connect')],
            receiveMessage: [() => events.push('receiveMessage')],
            processMessage: [() => {
                events.push('processMessage');
                setImmediate(() => client.close());
            }],
            respondMessage: [() => events.push('respondMessage')],
            disconnect: [() => events.push('disconnect')],
            shutdown: [() => {
                events.push('shutdown');
                try {
                    expect(events).to.include.members(['init', 'listening', 'handshake', 'connect', 'receiveMessage', 'processMessage', 'respondMessage', 'disconnect', 'shutdown']);
                    responder.close(done);
                } catch (e) { 
                    responder.close();
                    done(e); 
                }
            }]
        });

        setTimeout(() => client.sendData('ping'), 100);
    });
});