// Serves the showcase page on http://localhost:5179 for ndemo to record.
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript" };
createServer((req, res) => {
  const path = normalize(join(here, req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0])));
  if (!path.startsWith(here) || !existsSync(path)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}).listen(5179, "127.0.0.1", () => console.log("showcase on http://localhost:5179"));
