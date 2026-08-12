// =============================================================================
// Katrazado — Server Entry Point
// =============================================================================

'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerSocketHandlers } = require('./socketHandlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Serve static files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback to index.html for SPA
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Register Socket.IO handlers
registerSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║         🃏  KATRAZADO  🃏           ║
  ║                                      ║
  ║   Server running on port ${String(PORT).padEnd(5)}      ║
  ║   http://localhost:${PORT}             ║
  ╚══════════════════════════════════════╝
  `);
});
