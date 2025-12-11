"use strict";

/*
  Authentication endpoints:
  - POST /register
*/

const utils = require("./utils");
const storage = require("./storage");

/*
  request body (JSON): { nick, password }
  returns 200 JSON on success (registered or logged in), errors otherwise
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

      return utils.sendJSON(res, 200, {});
    }

    if (storage.verifyPassword(nick, password)) {
      return utils.sendJSON(res, 200, {});
    }

    return utils.sendError(res, 400, "User registered with a different password");
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

module.exports = { handleRegister };