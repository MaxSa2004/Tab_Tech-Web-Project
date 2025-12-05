"use strict";

/*
  Authentication endpoints.
  - POST /register  (idempotent: create or login-if-same-password)
  - POST /login     (explicit login)
*/

const utils = require("../lib/utils");
const storage = require("../lib/storage");

/**
 * handleRegister - register a new user or accept existing user if password matches.
 * Behavior:
 * - If nick does not exist: create and return 201.
 * - If nick exists and password matches: return 200 (treat as login).
 * - If nick exists and password differs: return 401 (invalid credentials).
 * Request body (JSON): { nick, password }
 */
async function handleRegister(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password } = body;
    if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(password)) {
      return utils.sendError(res, 400, "nick and password required");
    }

    const existing = storage.users.get(nick);
    if (!existing) {
      // create new user record in memory
      storage.users.set(nick, { password, wins: 0, plays: 0 });
      return utils.sendJSON(res, 201, {
        ok: true,
        nick,
        message: "registered",
      });
    }

    // If user exists and password matches, treat as successful login
    if (existing.password === password) {
      return utils.sendJSON(res, 200, {
        ok: true,
        nick,
        message: "already registered, logged in",
      });
    }

    // Password mismatch -> unauthorized
    return utils.sendError(res, 401, "invalid credentials");
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/**
 * handleLogin - explicit login endpoint.
 * Validates that the nick exists and the provided password matches the stored password.
 * Request body (JSON): { nick, password }
 */
async function handleLogin(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password } = body;
    if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(password)) {
      return utils.sendError(res, 400, "nick and password required");
    }
    const user = storage.users.get(nick);
    if (!user || user.password !== password) {
      return utils.sendError(res, 401, "invalid credentials");
    }
    return utils.sendJSON(res, 200, { ok: true, nick });
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

module.exports = { handleRegister, handleLogin };
