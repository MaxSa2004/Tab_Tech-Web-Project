"use strict";

/*
  Main entrypoint:
  - wires modules together
  - creates HTTP server and starts listening
  - keeps configuration (PORT, PUBLIC_DIR)
*/

const http = require("http");
const path = require("path");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8136;
const PUBLIC_DIR = path.join(__dirname, "public");

const router = require("./lib/router");
const utils = require("./lib/utils");

// Initialize router with runtime configuration (public directory)
router.init({ publicDir: PUBLIC_DIR });

// Create HTTP server and delegate handling to router
const server = http.createServer((req, res) => {
  // Handle simple CORS preflight for all endpoints
  if (req.method === "OPTIONS") {
    utils.setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Delegate the request to router
  router.handleRequest(req, res);
});

// Start listening on configured port and localhost
server.listen(PORT, "localhost", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
