"use strict";

/*
  Utility helpers used by handlers and router.
  Keeps small, testable functions (JSON parsing, SSE helpers, static serving).
*/

const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

/**
 * setCorsHeaders - set permissive CORS headers on a response.
 * @param {http.ServerResponse} res
 * @param {string} origin
 */
function setCorsHeaders(res, origin = "*") {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * sendJSON - send a JSON response with the provided HTTP status code.
 * Adds CORS headers first.
 * @param {http.ServerResponse} res
 * @param {number} code
 * @param {Object} obj
 */
function sendJSON(res, code, obj) {
  setCorsHeaders(res);
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * sendError - convenience wrapper to send a JSON error object.
 * @param {http.ServerResponse} res
 * @param {number} code
 * @param {string} message
 */
function sendError(res, code, message) {
  sendJSON(res, code, { error: message });
}

/**
 * parseJSONBody - read and parse a JSON request body.
 * Resolves to {} when no body is present.
 * Rejects on invalid JSON or when the payload is too large.
 * @param {http.IncomingMessage} req
 * @returns {Promise<Object>}
 */
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        // Too large: destroy socket to avoid resource exhaustion
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

/**
 * parseUrlEncoded - parse a URL's query string into an object.
 * Used by GET endpoints (SSE / update, ranking) that accept urlencoded query params.
 * @param {string} reqUrl
 * @returns {Object}
 */
function parseUrlEncoded(reqUrl) {
  const idx = reqUrl.indexOf("?");
  if (idx === -1) return {};
  const qs = reqUrl.slice(idx + 1);
  return querystring.parse(qs);
}

/**
 * isNonEmptyString - simple validator for non-empty strings.
 * @param {*} v
 * @returns {boolean}
 */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * toInt - convert a numeric string or number to an integer.
 * Returns NaN on failure.
 * @param {*} v
 * @returns {number}
 */
function toInt(v) {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  return NaN;
}

/**
 * contentTypeFor - minimal content type detection for static files.
 * @param {string} filePath
 * @returns {string}
 */
function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/**
 * tryServeStatic - attempt to serve a static file from publicDir.
 * Returns true if a file was served, false otherwise.
 * Protects against directory traversal by ensuring resolved path starts with publicDir.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} publicDir
 * @returns {boolean}
 */
function tryServeStatic(req, res, publicDir) {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
  const fsPath = path.join(publicDir, decodeURIComponent(reqPath));
  if (!fsPath.startsWith(publicDir)) return false;
  try {
    if (fs.existsSync(fsPath) && fs.statSync(fsPath).isFile()) {
      const data = fs.readFileSync(fsPath);
      res.writeHead(200, { "Content-Type": contentTypeFor(fsPath) });
      res.end(data);
      return true;
    }
  } catch (e) {
    // ignore and fallback to not serving
  }
  return false;
}

module.exports = {
  setCorsHeaders,
  sendJSON,
  sendError,
  parseJSONBody,
  parseUrlEncoded,
  isNonEmptyString,
  toInt,
  tryServeStatic,
  contentTypeFor,
};
