"use strict";

/*
  file-backed persistence for users in ./data/users.json
  password hashing using crypto.scryptSync (hashPassword / verifyPassword)
*/

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TMP_USERS_FILE = path.join(DATA_DIR, "users.json.tmp");

const users = new Map(); // nick -> { password: 'salt:hex', victories:number, games:number }

/*
  games stored as { gameId -> { size, state } } where:
  - size: number (board columns)
  - state: snapshot object:
    {
      pieces: Array(4*size) of piece objects or null,
      initial: string|null,
      step: "from",
      turn: string|null,
      players: { [nick]: "Blue" | "Red" },
      lastDiceValue: int|null,
      lastSelectedIndex: int|null,
    }
*/
const games = new Map();

const sseClients = new Map(); // `${nick}:${game}` -> ServerResponse
const waitingClients = new Map(); // gameId -> Array<{nick,res,timer}>

// scrypt params (sync)
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

// persistence helpers
function loadUsersFromDiskSync() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) return;
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const [nick, rec] of Object.entries(obj)) {
      const password = rec.password;
      const victories = Number.isFinite(rec.victories) ? rec.victories : 0;
      const gamesCount = Number.isFinite(rec.games) ? rec.games : 0;
      users.set(nick, {
        password: String(password || ""),
        victories: victories || 0,
        games: gamesCount || 0,
      });
    }
    //console.log(`storage: loaded ${users.size} users from ${USERS_FILE}`);
  } catch (err) {
    //console.error("storage: error loading users from disk:", err);
  }
}

async function saveUsersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR))
      await fsp.mkdir(DATA_DIR, { recursive: true });
    const obj = {};
    for (const [nick, rec] of users.entries()) {
      obj[nick] = {
        password: rec.password,
        victories: rec.victories || 0,
        games: rec.games || 0,
      };
    }
    const json = JSON.stringify(obj, null, 2);
    await fsp.writeFile(TMP_USERS_FILE, json, "utf8");
    await fsp.rename(TMP_USERS_FILE, USERS_FILE);
    return true;
  } catch (err) {
    throw err;
  }
}

let _saveTimer = null;
function scheduleSaveUsers(delay = 200) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveUsersToDisk().catch(() => {});
  }, delay);
}

// Crypto helpers (scrypt)
function hashPassword(plain) {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

function verifyPassword(nick, plain) {
  const rec = users.get(nick);
  if (!rec || typeof rec.password !== "string") return false;
  const stored = rec.password;
  const idx = stored.indexOf(":");
  try {
    const salt = stored.slice(0, idx);
    const expectedHex = stored.slice(idx + 1);
    const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (expectedBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(expectedBuf, derived);
  } catch (e) {
    return false;
  }
}

// Public API
function getUser(nick) {
  return users.get(nick);
}
function setUser(nick, record) {
  users.set(nick, {
    password: record.password,
    victories: Number.isFinite(record.victories) ? record.victories : 0,
    games: Number.isFinite(record.games) ? record.games : 0,
  });
  scheduleSaveUsers();
}
function incrementGames(nick) {
  const u = users.get(nick) || { password: "", victories: 0, games: 0 };
  u.games = (u.games || 0) + 1;
  users.set(nick, u);
  scheduleSaveUsers();
  return u.games;
}
function incrementVictories(nick) {
  const u = users.get(nick) || { password: "", victories: 0, games: 0 };
  u.victories = (u.victories || 0) + 1;
  users.set(nick, u);
  scheduleSaveUsers();
  return u.victories;
}
function finalizeGameResult(participants = [], winner = null) {
  if (!Array.isArray(participants)) participants = [];
  const updated = [];
  for (const nick of participants) {
    const u = users.get(nick) || { password: "", victories: 0, games: 0 };
    u.games = (u.games || 0) + 1;
    if (winner && nick === winner) u.victories = (u.victories || 0) + 1;
    users.set(nick, u);
    updated.push({ nick, victories: u.victories || 0, games: u.games || 0 });
  }
  scheduleSaveUsers();
  return updated;
}
function getAllUsers() {
  return Array.from(users.entries()).map(([nick, u]) => ({
    nick,
    victories: u.victories,
    games: u.games,
  }));
}
function getRanking(limit = 10) {
  const arr = getAllUsers();
  arr.sort((a, b) => b.victories - a.victories);
  return arr.slice(0, limit);
}

loadUsersFromDiskSync();

module.exports = {
  games, // Map<gameId, { size, state }>
  sseClients,
  waitingClients,
  loadUsersFromDiskSync,
  getUser,
  setUser,
  incrementGames,
  incrementVictories,
  finalizeGameResult,
  getAllUsers,
  getRanking,
  hashPassword,
  verifyPassword,
};
