"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

const PORT = 8136;
const PUBLIC_DIR = path.join(__dirname, "public");

// In-memory stores (demo)
const users = new Map();
const games = new Map();
const sseClients = new Map(); // `${nick}:${game}` -> res

// ---- Utilities ----
function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function setCorsHeaders(res, origin = "*") {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // allow credentials if you need them:
  // res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function sendJSON(res, code, obj) {
  setCorsHeaders(res);
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, code, message) {
  sendJSON(res, code, { error: message });
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.socket.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function parseUrlEncoded(reqUrl) {
  const idx = reqUrl.indexOf("?");
  if (idx === -1) return {};
  const qs = reqUrl.slice(idx + 1);
  return querystring.parse(qs);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}
function toInt(v) {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  return NaN;
}

// Very small game helpers (keeps previous behaviour)
function ensureGame(gameId, size = 6) {
  if (!games.has(gameId)) {
    games.set(gameId, {
      size,
      players: [],
      turnIndex: 0,
      pieces: new Map(),
      winner: null,
    });
  }
  return games.get(gameId);
}
function getTurnNick(game) {
  if (!game.players.length) return null;
  return game.players[game.turnIndex];
}
function nextTurn(game) {
  if (!game.players.length) return null;
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  return game.players[game.turnIndex];
}
function broadcastGameEvent(gameId, eventName, data) {
  for (const [key, res] of sseClients.entries()) {
    if (key.endsWith(`:${gameId}`)) {
      const payload =
        `event: ${eventName}\n` + `data: ${JSON.stringify(data)}\n\n`;
      res.write(payload);
    }
  }
}
function snapshotForClient(gameId) {
  const game = games.get(gameId);
  if (!game)
    return {
      players: [],
      pieces: {},
      turn: null,
      initial: null,
      mustPass: false,
      winner: null,
    };
  const piecesObj = {};
  for (const [nick, arr] of game.pieces.entries())
    piecesObj[nick] = arr.slice();
  return {
    players: game.players.slice(),
    pieces: piecesObj,
    turn: getTurnNick(game),
    initial: game.players[0] || null,
    mustPass: false,
    winner: game.winner,
  };
}

// ---- Handlers ----
async function handleRegister(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { nick, password } = body;
    if (!isNonEmptyString(nick) || !isNonEmptyString(password))
      return sendError(res, 400, "nick and password required");
    if (users.has(nick)) return sendError(res, 409, "nick already registered");
    users.set(nick, { password, wins: 0, plays: 0 });
    sendJSON(res, 201, { ok: true, nick });
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

async function handleJoin(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { nick, password, size, game } = body;
    if (
      !isNonEmptyString(nick) ||
      !isNonEmptyString(password) ||
      !isNonEmptyString(game)
    ) {
      return sendError(res, 400, "nick, password and game required");
    }
    const sizeInt = toInt(size);
    if (!Number.isInteger(sizeInt) || sizeInt < 1)
      return sendError(res, 400, "size must be integer >= 1");
    const user = users.get(nick);
    if (!user || user.password !== password)
      return sendError(res, 401, "invalid credentials");

    const g = ensureGame(game, sizeInt);
    if (!g.players.includes(nick)) {
      g.players.push(nick);
      g.pieces.set(nick, Array(g.size).fill(0));
      user.plays = (user.plays || 0) + 1;
    }

    const resp = {
      ok: true,
      game,
      players: g.players.slice(),
      initial: g.players[0] || null,
      pieces: (() => {
        const o = {};
        for (const [k, arr] of g.pieces.entries()) o[k] = arr.slice();
        return o;
      })(),
      turn: getTurnNick(g),
      mustPass: false,
    };
    broadcastGameEvent(game, "join", { players: resp.players });
    sendJSON(res, 200, resp);
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

async function handleLeave(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { nick, password, game } = body;
    if (
      !isNonEmptyString(nick) ||
      !isNonEmptyString(password) ||
      !isNonEmptyString(game)
    )
      return sendError(res, 400, "nick, password, game required");
    const user = users.get(nick);
    if (!user || user.password !== password)
      return sendError(res, 401, "invalid credentials");
    const g = games.get(game);
    if (!g) return sendError(res, 404, "game not found");

    g.players = g.players.filter((p) => p !== nick);
    g.pieces.delete(nick);
    if (g.turnIndex >= g.players.length) g.turnIndex = 0;
    if (g.players.length === 1) {
      g.winner = g.players[0];
      const winnerUser = users.get(g.winner);
      if (winnerUser) winnerUser.wins = (winnerUser.wins || 0) + 1;
    }
    broadcastGameEvent(game, "leave", {
      players: g.players.slice(),
      winner: g.winner || null,
    });
    sendJSON(res, 200, {
      ok: true,
      game,
      players: g.players.slice(),
      winner: g.winner || null,
    });
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

async function handleRoll(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { nick, password, game, cell } = body;
    if (
      !isNonEmptyString(nick) ||
      !isNonEmptyString(password) ||
      !isNonEmptyString(game)
    )
      return sendError(res, 400, "nick, password, game required");
    const cellInt = toInt(cell);
    if (!Number.isInteger(cellInt) || cellInt < 0)
      return sendError(res, 400, "cell must be integer >= 0");
    const user = users.get(nick);
    if (!user || user.password !== password)
      return sendError(res, 401, "invalid credentials");
    const g = games.get(game);
    if (!g) return sendError(res, 404, "game not found");
    if (g.winner) return sendError(res, 409, "game finished");
    if (getTurnNick(g) !== nick) return sendError(res, 403, "not your turn");

    const dice = Math.floor(Math.random() * 6) + 1;
    const pieces = g.pieces.get(nick) || Array(g.size).fill(0);
    const pieceIndex = Math.min(cellInt, pieces.length - 1);
    const from = pieces[pieceIndex];
    const to = from + dice;
    pieces[pieceIndex] = to;
    g.pieces.set(nick, pieces);

    const finishLine = g.size * 10;
    let winner = null;
    if (to >= finishLine) {
      winner = nick;
      g.winner = nick;
      const u = users.get(nick);
      if (u) u.wins = (u.wins || 0) + 1;
    }
    const next = winner ? null : nextTurn(g);

    const resp = {
      ok: true,
      dice,
      cell: to,
      selected: [from, to],
      step: 1,
      pieces: (() => {
        const o = {};
        for (const [k, arr] of g.pieces.entries()) o[k] = arr.slice();
        return o;
      })(),
      turn: next,
      winner: winner || null,
    };
    broadcastGameEvent(game, "roll", resp);
    sendJSON(res, 200, resp);
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

async function handlePass(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { nick, password, game } = body;
    if (
      !isNonEmptyString(nick) ||
      !isNonEmptyString(password) ||
      !isNonEmptyString(game)
    )
      return sendError(res, 400, "nick, password, game required");
    const user = users.get(nick);
    if (!user || user.password !== password)
      return sendError(res, 401, "invalid credentials");
    const g = games.get(game);
    if (!g) return sendError(res, 404, "game not found");
    if (g.winner) return sendError(res, 409, "game finished");
    if (getTurnNick(g) !== nick) return sendError(res, 403, "not your turn");

    const next = nextTurn(g);
    const resp = { ok: true, game, turn: next, mustPass: true };
    broadcastGameEvent(game, "pass", resp);
    sendJSON(res, 200, resp);
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

async function handleNotify(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { nick, password, game, cell } = body;
    if (
      !isNonEmptyString(nick) ||
      !isNonEmptyString(password) ||
      !isNonEmptyString(game)
    )
      return sendError(res, 400, "nick, password, game required");
    const cellInt = toInt(cell);
    if (!Number.isInteger(cellInt) || cellInt < 0)
      return sendError(res, 400, "cell must be integer >= 0");
    const user = users.get(nick);
    if (!user || user.password !== password)
      return sendError(res, 401, "invalid credentials");
    const g = games.get(game);
    if (!g) return sendError(res, 404, "game not found");

    const pieces = g.pieces.get(nick) || Array(g.size).fill(0);
    const from = pieces[0];
    pieces[0] = cellInt;
    g.pieces.set(nick, pieces);

    const resp = {
      ok: true,
      cell: cellInt,
      selected: [from, cellInt],
      pieces: (() => {
        const o = {};
        for (const [k, arr] of g.pieces.entries()) o[k] = arr.slice();
        return o;
      })(),
      turn: getTurnNick(g),
    };
    broadcastGameEvent(game, "notify", resp);
    sendJSON(res, 200, resp);
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

function handleUpdate(req, res) {
  const q = parseUrlEncoded(req.url);
  const { nick, game } = q;
  if (!isNonEmptyString(nick) || !isNonEmptyString(game))
    return sendError(res, 400, "nick and game required");

  setCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");

  const key = `${nick}:${game}`;
  sseClients.set(key, res);
  const snap = snapshotForClient(game);
  res.write(`event: update\ndata: ${JSON.stringify(snap)}\n\n`);

  const keep = setInterval(() => {
    if (!res.writableEnded) res.write(`: keepalive\n\n`);
  }, 20000);
  req.on("close", () => {
    clearInterval(keep);
    sseClients.delete(key);
  });
}

function handleRanking(req, res) {
  const q = parseUrlEncoded(req.url);
  const { nick } = q;
  if (!isNonEmptyString(nick))
    return sendError(res, 400, "nick query required");
  const ranking = Array.from(users.entries()).map(([n, u]) => ({
    nick: n,
    wins: u.wins || 0,
    plays: u.plays || 0,
  }));
  ranking.sort((a, b) => b.wins - a.wins);
  sendJSON(res, 200, { ok: true, ranking });
}

// ---- Static file serving helper ----
function tryServeStatic(req, res) {
  // Serve index.html for root and fallback for single-page app
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
  const fsPath = path.join(PUBLIC_DIR, decodeURIComponent(reqPath));
  if (!fsPath.startsWith(PUBLIC_DIR)) return false; // basic security
  try {
    if (fs.existsSync(fsPath) && fs.statSync(fsPath).isFile()) {
      const data = fs.readFileSync(fsPath);
      res.writeHead(200, { "Content-Type": contentTypeFor(fsPath) });
      res.end(data);
      return true;
    }
  } catch (e) {
    // ignore and fallback
  }
  return false;
}

// ---- Router ----
const server = http.createServer((req, res) => {
  // Handle CORS preflight quickly
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Try static files first (so SPA and scripts are served from same origin)
  if (req.method === "GET" && tryServeStatic(req, res)) return;

  const urlPath = req.url.split("?")[0] || "/";
  const pathname = urlPath.replace(/^\/+|\/+$/g, "");

  if (pathname === "register" && req.method === "POST")
    return handleRegister(req, res);
  if (pathname === "join" && req.method === "POST") return handleJoin(req, res);
  if (pathname === "leave" && req.method === "POST")
    return handleLeave(req, res);
  if (pathname === "roll" && req.method === "POST") return handleRoll(req, res);
  if (pathname === "pass" && req.method === "POST") return handlePass(req, res);
  if (pathname === "notify" && req.method === "POST")
    return handleNotify(req, res);
  if (pathname === "update" && req.method === "GET")
    return handleUpdate(req, res);
  if (pathname === "ranking" && req.method === "GET")
    return handleRanking(req, res);

  // root or unknown fallback
  if (pathname === "" && req.method === "GET") {
    setCorsHeaders(res);
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

  sendError(res, 404, "not found");
});

server.listen(PORT, "localhost", () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
