"use strict";

/*
  Simple router: maps paths and methods to handlers.
  Exposes init({ publicDir }) and handleRequest(req, res).
*/

const handlersAuth = require("./auth");
const handlersGame = require("./game");
const handlersUpdate = require("./update");
const utils = require("./utils");

let PUBLIC_DIR = null;

// provide runtime configuration to the router
// publicDir - path to static files
function init({ publicDir }) {
  PUBLIC_DIR = publicDir;
}

/* 
primary entrypoint for the HTTP server.
 - serves static files from PUBLIC_DIR for GET requests
 - dispatches API routes to handler modules
 */
async function handleRequest(req, res) {
  // Serve static SPA first for GET requests
  if (
    req.method === "GET" &&
    PUBLIC_DIR &&
    utils.tryServeStatic(req, res, PUBLIC_DIR)
  ) {
    return;
  }

  const urlPath = req.url.split("?")[0] || "/";
  const pathname = urlPath.replace(/^\/+|\/+$/g, "");

  // Authentication
  if (pathname === "register" && req.method === "POST")
    return handlersAuth.handleRegister(req, res);

  // Game operations
  if (pathname === "join" && req.method === "POST")
    return handlersGame.handleJoin(req, res);
  if (pathname === "leave" && req.method === "POST")
    return handlersGame.handleLeave(req, res);
  if (pathname === "roll" && req.method === "POST")
    return handlersGame.handleRoll(req, res);
  if (pathname === "pass" && req.method === "POST")
    return handlersGame.handlePass(req, res);
  if (pathname === "notify" && req.method === "POST")
    return handlersGame.handleNotify(req, res);

  // Updates (SSE) and ranking
  if (pathname === "update" && req.method === "GET")
    return handlersUpdate.handleUpdate(req, res);
  if (pathname === "ranking" && req.method === "GET")
    return handlersGame.handleRanking(req, res);

  // Root informational endpoint
  if (pathname === "" && req.method === "GET") {
    utils.setCorsHeaders(res);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        endpoints: [
          "register",
          "join",
          "leave",
          "roll",
          "pass",
          "notify",
          "update (SSE)",
          "ranking",
        ],
      })
    );
    return;
  }

  // No matching route
  utils.sendError(res, 404, "not found");
}

module.exports = {
  init,
  handleRequest,
};
