import { copyFileSync, mkdirSync } from "node:fs";
import * as esbuild from "esbuild";

mkdirSync("dist", { recursive: true });
await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "chrome120",
  charset: "utf8",
  legalComments: "none",
  loader: { ".woff2": "dataurl" },
  outfile: "dist/main.js",
});
copyFileSync("src/index.html", "dist/index.html");
console.log("built companion web assets");
