"use strict";

/*
  - Utility helpers used by handlers and router.
  - Keeps small, testable functions (JSON parsing, SSE helpers, static serving).
*/

const fs = require("fs");
const path = require("path");
const querystring = require("querystring"); // convert query part of url into object for handlers

// set permissive CORS headers on a response
function setCorsHeaders(res, origin = "*") {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// send a JSON response with the provided HTTP status code
function sendJSON(res, code, obj) {
  setCorsHeaders(res); // headers first
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// wrapper to send a JSON error object
function sendError(res, code, message) {
  sendJSON(res, code, { error: message });
}

// read and parse a JSON request body
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        // Too large: destroy socket to avoid resource exhaustion
        req.socket.destroy();
        reject(new Error("Payload too large")); // exceeds 1e6 chars
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({}); // no body present
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// parse a URL's query string into an object
function parseUrlEncoded(reqUrl) {
  const idx = reqUrl.indexOf("?");
  if (idx === -1) return {};
  const qs = reqUrl.slice(idx + 1);
  return querystring.parse(qs);
}

// validator for non-empty strings
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

// convert a numeric string or number to an integer
function toInt(v) {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  return NaN;
}

// minimal content type detection for static files
function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/*
  attempts to serve a static file from publicDir (where index.html is)
  returns true if a file was served, otherwise false
  protects against directory traversal by ensuring resolved path starts with publicDir
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
