import { copyFileSync, mkdirSync } from "node:fs";
import * as esbuild from "esbuild";

const shared = {
  bundle: true,
  minify: true,
  target: "chrome120",
  charset: "utf8",
  legalComments: "none",
  loader: { ".woff2": "dataurl" },
};

mkdirSync("dist", { recursive: true });
await esbuild.build({ ...shared, entryPoints: ["src/content.ts"], format: "iife", outfile: "dist/content.js" });
await esbuild.build({ ...shared, entryPoints: ["src/background.ts"], format: "esm", outfile: "dist/background.js" });
copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("../companion/src-tauri/icons/128x128.png", "dist/icon128.png");
copyFileSync("../companion/src-tauri/icons/32x32.png", "dist/icon32.png");
console.log("built dist/ (load this folder as an unpacked extension)");
