import { createServer } from "http";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const { default: handler } = await import("./dist/server/server.js");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

createServer(async (req, res) => {
  // Serve static assets
  const staticPath = join(__dirname, "dist/client", req.url.split("?")[0]);
  if (existsSync(staticPath) && !staticPath.endsWith("/")) {
    const ext = extname(staticPath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const file = await readFile(staticPath);
    res.writeHead(200, { "Content-Type": contentType });
    return res.end(file);
  }

  // SSR handler
  const url = new URL(req.url, `http://${req.headers.host}`);
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  const body = ["GET", "HEAD"].includes(req.method) ? null : await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const request = new Request(url.toString(), { method: req.method, headers, body });

  try {
    const response = await handler.fetch(request, {}, {});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
