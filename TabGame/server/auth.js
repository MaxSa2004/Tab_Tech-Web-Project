"use strict";

/*
  Authentication endpoints.
  - POST /register
*/

const utils = require("./utils");
const storage = require("./storage");

/* handleRegister
  Request body (JSON): { nick, password }
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
      // 201 = created
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

module.exports = { handleRegister };
