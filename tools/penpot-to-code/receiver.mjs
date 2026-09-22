/**
 * Catches a Penpot file pushed from a browser tab on design.penpot.app.
 *
 * Penpot's API sits behind Cloudflare, which challenges plain HTTP clients, so
 * Node cannot call it directly — but a real browser tab can, and a page on a
 * public https origin may POST to loopback if the local server opts in to
 * Chrome's Private Network Access check. That opt-in is the
 * Access-Control-Allow-Private-Network header below; without it the browser
 * refuses the request before it is ever sent.
 *
 *   node tools/penpot-to-code/receiver.mjs [--port 7788] [--out design-dumps]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const port = Number(flag("port", 7788));
const outDir = path.resolve(flag("out", "design-dumps"));
fs.mkdirSync(outDir, { recursive: true });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(200, { ...CORS, "content-type": "text/plain" }).end("ready");
      return;
    }

    const name = decodeURIComponent(req.url.replace(/^\/dump\/?/, "")) || "dump";
    const file = path.join(outDir, `${name.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);

    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      fs.writeFileSync(file, body);
      console.log(`${(body.length / 1024 / 1024).toFixed(2)} MB -> ${file}`);
      res.writeHead(200, { ...CORS, "content-type": "application/json" }).end(
        JSON.stringify({ ok: true, bytes: body.length, file }),
      );
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`receiver on http://127.0.0.1:${port}, writing to ${outDir}`);
  });
