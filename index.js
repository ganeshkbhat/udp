const net = require('net');
const dgram = require('dgram');

// ProtocolServer (Function Implementation)
function ProtocolServer(protocolName) {
  this.protocolName = protocolName;
  this.eventHandlers = {
    init: [],
    listening: [],
    handshake: [],
    connect: [],
    receiveMessage: [],
    processMessage: [],
    respondMessage: [],
    disconnect: [],
    shutdown: [],
    error: [],
  };
  this._defaultErrorHandler = (err, eventName, ...args) => {
    console.warn(`[${this.protocolName} Server] Error in event "${eventName}":`, err, ...args);
  };
  this.onError(this._defaultErrorHandler);
}

ProtocolServer.prototype.on = function(event, handler) {
  if (this.eventHandlers[event]) {
    if (event !== 'error' && this.eventHandlers[event].length === 0 && this.eventHandlers.error.includes(this._defaultErrorHandler)) {
      this.eventHandlers.error = this.eventHandlers.error.filter(h => h !== this._defaultErrorHandler);
    }
    this.eventHandlers[event].push(handler);
  } else {
    console.warn(`Event "${event}" is not a supported lifecycle event for ${this.protocolName}.`);
  }
};

ProtocolServer.prototype.onError = function(handler) {
  if (this.eventHandlers.error.includes(this._defaultErrorHandler)) {
    this.eventHandlers.error = this.eventHandlers.error.filter(h => h !== this._defaultErrorHandler);
  }
  this.on('error', handler);
};

ProtocolServer.prototype.call = async function(event, ...args) {
  if (this.eventHandlers[event]) {
    for (const handler of this.eventHandlers[event]) {
      try {
        await handler.apply(this, args);
      } catch (error) {
        console.error(`[${this.protocolName} Server] Error during ${event} event:`, error);
        this.call('error', error, event, ...args);
      }
    }
  } else {
    console.warn(`No handlers registered for event "${event}" in ${this.protocolName}.`);
    this.call('error', new Error(`No handlers defined for event "${event}"`), event, ...args);
  }
};

ProtocolServer.prototype.init = async function(config) {
  console.log(`${this.protocolName} server initializing...`);
  try {
    await this.call('init', config);
    console.log(`${this.protocolName} server initialized.`);
  } catch (error) {
      //errors are handled by the this.call
  }
};

ProtocolServer.prototype.listen = async function(port, address) {
  try {
    if (this.protocolName !== 'UDP') {
      console.log(`${this.protocolName} server listening on ${address}:${port}...`);
      await this.call('listening', port, address);
    } else {
      console.log(`${this.protocolName} server bound to ${address}:${port}...`);
      await this.call('listening', port, address); // 'listening' makes sense for UDP as well
    }
  } catch (error) {
      //errors are handled by this.call
  }
};

ProtocolServer.prototype.handleConnection = async function(socket) {
  const self = this; // Preserve 'this' context
  console.log(`${this.protocolName} client connected.`);
  try {
    await this.call('connect', socket);

    socket.on('data', async (data) => {
      try {
        console.log(`${self.protocolName} received data:`, data);
        await self.call('receiveMessage', socket, data);

        const processedData = await self.processMessage(socket, data);
        if (processedData !== undefined) {
          await self.call('processMessage', socket, data, processedData);
          await self.respond(socket, processedData);
        }
      } catch (error) {
        console.error(`${self.protocolName} error handling data:`, error);
        self.call('error', error, 'receiveMessage', socket, data);
      }
    });

    socket.on('end', async () => {
      try {
        console.log(`${self.protocolName} client disconnected.`);
        await self.call('disconnect', socket);
      } catch (error) {
        console.error(`${self.protocolName} error during disconnect:`, error);
        self.call('error', error, 'disconnect', socket);
      }
    });

    socket.on('error', (err) => {
      console.error(`${self.protocolName} socket error:`, err);
      self.call('error', err, 'socketError', socket); // Using 'socketError' for clarity
    });
  } catch (error) {
    console.error(`${this.protocolName} error during connection handling:`, error);
    self.call('error', error, 'connect', socket);
  }
};

ProtocolServer.prototype.handleHandshake = async function(socket) {
  console.log(`${this.protocolName} performing handshake...`);
  try {
    await this.call('handshake', socket);
    console.log(`${this.protocolName} handshake complete.`);
  } catch (error) {
    console.error(`${this.protocolName} error during handshake:`, error);
    this.call('error', error, 'handshake', socket);
  }
};

ProtocolServer.prototype.receive = async function(socket, message) {
  try {
    console.log(`${this.protocolName} received message:`, message);
    await this.call('receiveMessage', socket, message);
  } catch (error) {
    console.error(`${this.protocolName} error during receive:`, error);
    this.call('error', error, 'receive', socket, message);
  }
};

ProtocolServer.prototype.processMessage = async function(socket, message) {
  console.log(`${this.protocolName} processing message:`, message);
  try {
    await this.call('processMessage', socket, message);
    return undefined; // By default, no response
  } catch (error) {
    console.error(`${this.protocolName} error processing message:`, error);
    this.call('error', error, 'processMessage', socket, message);
    throw error; // Re-throw to potentially stop further processing
  }
};

ProtocolServer.prototype.respond = async function(socket, response, rinfo) {
  console.log(`${this.protocolName} sending response:`, response);
  try {
    await this.call('respondMessage', socket, response, rinfo);
    if (socket && socket.writable) {
      socket.write(response);
    } else if (socket && rinfo) { //handle the rinfo
        const buffer = Buffer.from(response);
        socket.send(buffer, 0, buffer.length, rinfo.port, rinfo.address, (err) => {
            if(err){
                console.error(`[${this.protocolName}] error sending udp response:`, err);
                this.call('error', err, 'respond', socket, response, rinfo);
            }
        });
    }
    else {
      console.warn(`${this.protocolName}: Cannot send response on this socket.`);
    }
  } catch (error) {
    console.error(`${this.protocolName} error during respond:`, error);
    this.call('error', error, 'respond', socket, response, rinfo);
  }
};

ProtocolServer.prototype.disconnect = async function(socket) {
  console.log(`${this.protocolName} disconnecting client.`);
  try {
    await this.call('disconnect', socket);
    if (socket) {
      socket.end();
      socket.destroy();
    }
  } catch (error) {
    console.error(`${this.protocolName} error during disconnect:`, error);
    this.call('error', error, 'disconnect', socket);
  }
};

ProtocolServer.prototype.shutdown = async function() {
  console.log(`${this.protocolName} server shutting down...`);
  try {
    await this.call('shutdown');
    console.log(`${this.protocolName} server shut down.`);
  } catch (error) {
    console.error(`${this.protocolName} error during shutdown:`, error);
    this.call('error', error, 'shutdown');
  }
};

// TCP Server (Function Implementation)
function TCPServer() {
  ProtocolServer.call(this, 'TCP');
  this.server = null;
}

// Inherit prototype methods from ProtocolServer
TCPServer.prototype = Object.create(ProtocolServer.prototype);
TCPServer.prototype.constructor = TCPServer;

TCPServer.prototype.listen = async function(port, address = '0.0.0.0') {
  await ProtocolServer.prototype.listen.call(this, port, address);
  const self = this;
  return new Promise((resolve, reject) => {
    self.server = net.createServer((socket) => {
      self.handleConnection(socket);
    });

    self.server.on('listening', () => {
      console.log(`TCP server listening on ${address}:${port}`);
      resolve();
    });

    self.server.on('error', (err) => {
      console.error('TCP server error:', err);
      self.call('error', err, 'listen');
      reject(err);
    });

    self.server.listen(port, address);
  });
};

TCPServer.prototype.shutdown = async function() {
  await ProtocolServer.prototype.shutdown.call(this);
  const self = this;
  return new Promise((resolve) => {
    if (self.server) {
      self.server.close(() => {
        console.log('TCP server closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
};

// UDP Server (Function Implementation)
function UDPServer() {
  ProtocolServer.call(this, 'UDP');
  this.server = null;
}

// Inherit prototype methods from ProtocolServer
UDPServer.prototype = Object.create(ProtocolServer.prototype);
UDPServer.prototype.constructor = UDPServer;

UDPServer.prototype.listen = async function(port, address = '0.0.0.0') {
  await ProtocolServer.prototype.listen.call(this, port, address);
  const self = this;
  return new Promise((resolve, reject) => {
    self.server = dgram.createSocket('udp4'); // Assuming IPv4 for simplicity

    self.server.on('message', (msg, rinfo) => {
      console.log(`UDP server received message from ${rinfo.address}:${rinfo.port}: ${msg.toString()}`);
      self.call('receiveMessage', self.server, msg, rinfo); // Pass rinfo for responding

      self.processMessage(self.server, msg, rinfo)
        .then(response => {
          if (response !== undefined) {
            self.respond(self.server, response, rinfo);
          }
        })
        .catch(err => {
          console.error('Error processing UDP message:', err);
          self.call('error', err, 'processMessage', self.server, msg, rinfo);
        });
    });

    self.server.on('listening', () => {
      const serverAddress = self.server.address();
      console.log(`UDP server listening on ${serverAddress.address}:${serverAddress.port}`);
      resolve();
    });

    self.server.on('error', (err) => {
      console.error('UDP server error:', err);
      self.call('error', err, 'listen');
      reject(err);
    });

    self.server.bind(port, address);
  });
};

// Override processMessage to accept rinfo for UDP
UDPServer.prototype.processMessage = async function(socket, message, rinfo) {
  console.log('UDP server processing message:', message.toString(), rinfo);
  await ProtocolServer.prototype.processMessage.call(this, socket, message, rinfo);
  return undefined; // By default, no response
};

// Override respond for UDP to use send with rinfo
UDPServer.prototype.respond = async function(socket, response, rinfo) {
  console.log('UDP server sending response:', response, rinfo);
  await ProtocolServer.prototype.respond.call(this, socket, response, rinfo);
};

UDPServer.prototype.shutdown = async function() {
  await ProtocolServer.prototype.shutdown.call(this);
  const self = this;
  return new Promise((resolve) => {
    if (self.server) {
      self.server.close(() => {
        console.log('UDP server closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports = { ProtocolServer, TCPServer, UDPServer };

// Example Usage (same as before, but using the function implementations):
async function runServers() {
  // TCP Server Example
  const tcpServer = new TCPServer();

  tcpServer.on('init', (config) => {
    console.log('TCP Server initialized with config:', config);
  });

  tcpServer.on('connect', (socket) => {
    console.log('TCP Client connected:', socket.remoteAddress + ':' + socket.remotePort);
    socket.write('Welcome to the TCP server!\r\n');
  });

  tcpServer.on('receiveMessage', (socket, data) => {
    console.log('TCP Received:', data.toString().trim());
    socket.write(`You sent: ${data.toString().trim()}\r\n`);
  });

  tcpServer.on('disconnect', (socket) => {
    console.log('TCP Client disconnected:', socket.remoteAddress + ':' + socket.remotePort);
  });

  tcpServer.onError((err, eventName, ...args) => {
    console.error(`[TCP Server] Error in event "${eventName}":`, err, ...args);
  });

  await tcpServer.init({ some: 'tcp config' });
  await tcpServer.listen(3000);

  // UDP Server Example
  const udpServer = new UDPServer();

  udpServer.on('init', (config) => {
    console.log('UDP Server initialized with config:', config);
  });

  udpServer.on('receiveMessage', (socket, msg, rinfo) => {
    console.log(`UDP Received from ${rinfo.address}:${rinfo.port}: ${msg.toString()}`);
  });

  udpServer.on('processMessage', async (socket, msg, rinfo) => {
    const response = `Echo from UDP server: ${msg.toString()}`;
    return response;
  });

  udpServer.on('respondMessage', (socket, response, rinfo) => {
    console.log(`UDP Sent to ${rinfo.address}:${rinfo.port}: ${response}`);
  });

  udpServer.onError((err, eventName, ...args) => {
    console.error(`[UDP Server] Error in event "${eventName}":`, err, ...args);
  });

  await udpServer.init({ some: 'udp config' });
  await udpServer.listen(4000);

  console.log('Servers are running...');
}

// runServers();
