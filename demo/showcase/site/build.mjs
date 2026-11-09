// Bundles the showcase page. Run from the repo root: node demo/showcase/site/build.mjs
import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
await esbuild.build({
  entryPoints: [join(here, "main.ts")],
  outfile: join(here, "main.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  loader: { ".woff2": "dataurl" },
  nodePaths: [join(here, "../../../node_modules")],
});
console.log("built demo/showcase/site/main.js");
