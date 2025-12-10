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
const games = new Map(); // gameId -> { size, players, turnIndex, pieces:Map, winner }
const sseClients = new Map(); // `${nick}:${game}` -> ServerResponse

// scrypt params (sync) - scrypt used as it is more secure than MD5
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

// persistence helpers
/*
  reads the users JSON file synchronously at startup
  populates the in-memory users Map with normalized records
 */
function loadUsersFromDiskSync() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) return;
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const [nick, rec] of Object.entries(obj)) {
      // Support both new and old field names. Prefer new names if present.
      const password = rec.password;
      const victories = Number.isFinite(rec.victories) ? rec.victories : 0;
      const gamesCount = Number.isFinite(rec.games) ? rec.games : 0;
      users.set(nick, {
        password: String(password || ""),
        victories: victories || 0,
        games: gamesCount || 0,
      });
    }
    console.log(`storage: loaded ${users.size} users from ${USERS_FILE}`);
  } catch (err) {
    console.error("storage: error loading users from disk:", err);
  }
}

/*
  asynchronously writes the current users Map to disk:
    - write to a tmp file, then rename to the final filename
  returns a Promise that resolves on success or rejects on error.
 */
async function saveUsersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR))
      await fsp.mkdir(DATA_DIR, { recursive: true });
    // Convert Map to plain object with updated field names
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
    console.error("storage: saveUsersToDisk error:", err);
    throw err;
  }
}

let _saveTimer = null;

/*
  debounces saves to avoid excessive disk writes
  cancels previous timer if any and schedules a new one
 */
function scheduleSaveUsers(delay = 200) {
  // delay: ms to wait before calling saveUsersToDisk
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveUsersToDisk().catch(() => {
      // logged already
    });
  }, delay);
}

// Crypto helpers (scrypt)
/*
  generates a random salt and derives a key using crypto.scryptSync
  returns a string of format 'salt:derivedHex' suitable for storing
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

// crypto.timingSafeEqual for timing-safe comparison
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
// returns user from the in-memory Map
function getUser(nick) {
  return users.get(nick);
}

/*
  sets or replaces a user record in memory and schedules a debounced save
  normalizes numeric fields and stores them accordingly
 */
function setUser(nick, record) {
  users.set(nick, {
    password: record.password,
    victories: Number.isFinite(record.victories) ? record.victories : 0,
    games: Number.isFinite(record.games) ? record.games : 0,
  });
  scheduleSaveUsers();
}

// increment the games counter for the given nick
function incrementGames(nick) {
  const u = users.get(nick) || { password: "", victories: 0, games: 0 };
  u.games = (u.games || 0) + 1;
  users.set(nick, u);
  scheduleSaveUsers();
  return u.games;
}

// ncrement the victories counter for the given nick
function incrementVictories(nick) {
  const u = users.get(nick) || { password: "", victories: 0, games: 0 };
  u.victories = (u.victories || 0) + 1;
  users.set(nick, u);
  scheduleSaveUsers();
  return u.victories;
}

// returns an array of user summaries suitable for ranking or display
function getAllUsers() {
  return Array.from(users.entries()).map(([nick, u]) => ({
    nick,
    victories: u.victories,
    games: u.games,
  }));
}

// returns top limit users sorted by victories descending.
function getRanking(limit = 10) {
  const arr = getAllUsers();
  arr.sort((a, b) => b.victories - a.victories);
  return arr.slice(0, limit);
}

loadUsersFromDiskSync();

module.exports = {
  // singletons
  users,
  games,
  sseClients,

  // persistence control
  loadUsersFromDiskSync,

  // user API (new names etc)
  getUser,
  setUser,
  incrementGames,
  incrementVictories,
  getAllUsers,
  getRanking,

  // crypto helpers
  hashPassword,
  verifyPassword,
};
