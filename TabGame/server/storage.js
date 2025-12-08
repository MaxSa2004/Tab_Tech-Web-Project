"use strict";

/*
storage.js
  - In-memory singletons (users, games, sseClients).
  - File-backed persistence for users in ./data/users.json.
  - Password hashing using crypto.scryptSync (hashPassword / verifyPassword).
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

// ------------------ Persistence helpers ------------------

/*
 loadUsersFromDiskSync
 - Reads the users JSON file synchronously at startup.
 - Populates the in-memory `users` Map with normalized records.
 - No return value = logs errors to console.
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
      const victories = Number.isFinite(rec.victories)
        ? rec.victories
        : 0;
      const gamesCount = Number.isFinite(rec.games)
        ? rec.games
        : 0;
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

/**
 * saveUsersToDisk
 * - Asynchronously writes the current `users` Map to disk using an atomic pattern:
 *   write to a tmp file, then rename to the final filename.
 * - Returns a Promise that resolves on success or rejects on error.
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
scheduleSaveUsers
  - Debounces saves to avoid excessive disk writes.
  - delay: milliseconds to wait before calling saveUsersToDisk.
  - Cancels previous timer if any and schedules a new one.
 */
function scheduleSaveUsers(delay = 200) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveUsersToDisk().catch(() => {
      /* logged already */
    });
  }, delay);
}

/*
flushUsersSync
  - Synchronously writes the users file (used on process exit).
  - Ensures data is flushed to disk when the process terminates.
 */
function flushUsersSync() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj = {};
    for (const [nick, rec] of users.entries()) {
      obj[nick] = {
        password: rec.password,
        victories: rec.victories || 0,
        games: rec.games || 0,
      };
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), "utf8");
    if (fs.existsSync(TMP_USERS_FILE)) fs.unlinkSync(TMP_USERS_FILE);
  } catch (err) {
    console.error("storage: flushUsersSync error:", err);
  }
}

// Crypto helpers (scrypt)

/*
  Generates a random salt and derives a key using crypto.scryptSync.
  Returns a string in the format 'salt:derivedHex' suitable for storing.
  Input: plain (string) - the plaintext password.
  Output: string (salt:hex)
 */
function hashPassword(plain) {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

/**
 * verifyPassword
 * - Verifies a user-supplied plain password against the stored hashed password for nick.
 * - Only accepts stored format 'salt:hex'. If stored value is not in that format it rejects.
 * - Uses crypto.timingSafeEqual for timing-safe comparison.
 * - Returns boolean (true if match, false otherwise).
 */
function verifyPassword(nick, plain) {
  const rec = users.get(nick);
  if (!rec || typeof rec.password !== "string") return false;
  const stored = rec.password;
  const idx = stored.indexOf(":");
  if (idx <= 0) {
    // Reject any non "salt:hash" format (we expect stored passwords to be hashed)
    console.warn(
      `storage: user ${nick} has invalid password format; rejecting authentication`
    );
    return false;
  }
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

// ------------------ Public API ------------------

/**
 * getUser
 * - Returns the user record object from the in-memory Map, or undefined if not present.
 * - Returned object has keys: password (salt:hex), victories (number), games (number).
 */
function getUser(nick) {
  return users.get(nick);
}

/**
 * hasUser
 * - Returns true if the user nick exists in the users Map, false otherwise.
 */
function hasUser(nick) {
  return users.has(nick);
}

/**
 * setUser
 * - Sets or replaces a user record in memory and schedules a debounced save.
 * - Expects record.password to already be hashed via hashPassword().
 * - Normalizes numeric fields and stores them as victories/games.
 */
function setUser(nick, record) {
  users.set(nick, {
    password: record.password,
    victories: Number.isFinite(record.victories) ? record.victories : 0,
    games: Number.isFinite(record.games) ? record.games : 0,
  });
  scheduleSaveUsers();
}

/**
 * incrementGames
 * - Increment the 'games' counter for the given nick.
 * - If the user does not exist, creates a placeholder user (empty password).
 * - Schedules a debounced save and returns the new games count.
 */
function incrementGames(nick) {
  const u = users.get(nick) || { password: "", victories: 0, games: 0 };
  u.games = (u.games || 0) + 1;
  users.set(nick, u);
  scheduleSaveUsers();
  return u.games;
}

/**
 * incrementVictories
 * - Increment the 'victories' counter for the given nick.
 * - If the user does not exist, creates a placeholder user (empty password).
 * - Schedules a debounced save and returns the new victories count.
 */
function incrementVictories(nick) {
  const u = users.get(nick) || { password: "", victories: 0, games: 0 };
  u.victories = (u.victories || 0) + 1;
  users.set(nick, u);
  scheduleSaveUsers();
  return u.victories;
}

/**
 * getAllUsers
 * - Returns an array of user summaries suitable for ranking or display:
 *   [{ nick, victories, games }, ...]
 */
function getAllUsers() {
  return Array.from(users.entries()).map(([nick, u]) => ({
    nick,
    victories: u.victories || 0,
    games: u.games || 0,
  }));
}

/**
 * getRanking
 * - Returns top `limit` users sorted by victories descending.
 * - limit defaults to 10.
 * - Each entry: { nick, victories, games }
 */
function getRanking(limit = 10) {
  const arr = getAllUsers();
  arr.sort((a, b) => b.victories - a.victories);
  return arr.slice(0, limit);
}

loadUsersFromDiskSync();

process.on("exit", () => flushUsersSync());
process.on("SIGINT", () => {
  flushUsersSync();
  process.exit(0);
});
process.on("SIGTERM", () => {
  flushUsersSync();
  process.exit(0);
});

module.exports = {
  // singletons
  users,
  games,
  sseClients,

  // persistence control
  loadUsersFromDiskSync,
  //saveUsers,
  flushUsersSync,

  // user API (new names etc)
  getUser,
  hasUser,
  setUser,
  incrementGames,
  incrementVictories,
  getAllUsers,
  getRanking,

  // crypto helpers
  hashPassword,
  verifyPassword,
};
