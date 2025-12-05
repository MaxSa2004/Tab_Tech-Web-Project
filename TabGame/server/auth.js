"use strict";

/*
  Authentication endpoints.
  - POST /register
  - POST /login

  Now stores counters under fields:
    - games
    - victories
  Passwords must be hashed before storing (use storage.hashPassword()).
*/

const utils = require("./utils");
const storage = require("./storage");

/**
 * handleRegister
 * - Registers a new user with a hashed password, or returns 200 if the user already exists and password matches.
 * - Request body (JSON): { nick, password }
 * - Validates input, hashes the password using storage.hashPassword, stores user record with { password, victories:0, games:0 }.
 * - Returns:
 *   - 201 with { ok:true, nick, message:'registered' } when user created
 *   - 200 with { ok:true, nick, message:'already registered, logged in' } when password matches existing user
 *   - 400 when input invalid
 *   - 401 when credentials invalid
 */
async function handleRegister(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password } = body;
    if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(password)) {
      return utils.sendError(res, 400, "nick and password required");
    }

    const existing = storage.getUser(nick);
    if (!existing) {
      const hashed = storage.hashPassword(password);
      storage.setUser(nick, { password: hashed, victories: 0, games: 0 });
      // optional: await storage.saveUsers();
      return utils.sendJSON(res, 201, {
        ok: true,
        nick,
        message: "registered",
      });
    }

    if (storage.verifyPassword(nick, password)) {
      return utils.sendJSON(res, 200, {
        ok: true,
        nick,
        message: "already registered, logged in",
      });
    }

    return utils.sendError(res, 401, "invalid credentials");
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/**
 * handleLogin
 * - Explicit login. Request body: { nick, password }
 * - Validates input and verifies password using storage.verifyPassword.
 * - Returns:
 *   - 200 with { ok:true, nick } on success
 *   - 400 when input invalid
 *   - 401 when credentials invalid
 */
async function handleLogin(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password } = body;
    if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(password)) {
      return utils.sendError(res, 400, "nick and password required");
    }
    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password)) {
      return utils.sendError(res, 401, "invalid credentials");
    }
    return utils.sendJSON(res, 200, { ok: true, nick });
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

module.exports = { handleRegister, handleLogin };
