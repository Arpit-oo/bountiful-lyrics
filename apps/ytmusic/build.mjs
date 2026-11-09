// Builds the extension for Chromium browsers (Chrome, Brave, Edge) and Firefox, then copies both to
// the repo root as extension-chrome/ and extension-firefox/ so they are easy to find and load.
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as esbuild from "esbuild";

const shared = {
  bundle: true,
  minify: true,
  target: ["chrome120", "firefox121"],
  charset: "utf8",
  legalComments: "none",
  loader: { ".woff2": "dataurl" },
};

const template = JSON.parse(readFileSync("manifest.template.json", "utf8"));

const targets = {
  chrome: { dir: "dist", root: "../../extension-chrome", manifest: { ...template, background: { service_worker: "background.js", type: "module" } }, bgFormat: "esm" },
  firefox: {
    dir: "dist-firefox",
    root: "../../extension-firefox",
    // Firefox runs MV3 backgrounds as event pages (scripts), not service workers, and needs an id.
    manifest: {
      ...template,
      background: { scripts: ["background.js"] },
      browser_specific_settings: { gecko: { id: "bountiful-lyrics@bountiful.app", strict_min_version: "121.0", data_collection_permissions: { required: ["none"] } } },
    },
    bgFormat: "iife",
  },
};

for (const [name, t] of Object.entries(targets)) {
  rmSync(t.dir, { recursive: true, force: true });
  mkdirSync(t.dir, { recursive: true });
  await esbuild.build({ ...shared, entryPoints: ["src/content.ts"], format: "iife", outfile: `${t.dir}/content.js` });
  await esbuild.build({ ...shared, entryPoints: ["src/background.ts"], format: t.bgFormat, outfile: `${t.dir}/background.js` });
  writeFileSync(`${t.dir}/manifest.json`, JSON.stringify(t.manifest, null, 2));
  copyFileSync("../companion/src-tauri/icons/128x128.png", `${t.dir}/icon128.png`);
  copyFileSync("../companion/src-tauri/icons/32x32.png", `${t.dir}/icon32.png`);
  rmSync(t.root, { recursive: true, force: true });
  cpSync(t.dir, t.root, { recursive: true });
  console.log(`built ${name}: ${t.dir}/ (also copied to ${t.root.replace("../../", "")}/)`);
}
