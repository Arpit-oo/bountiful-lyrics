// Copies the built plugin to release/, the committed file that Marketplace and manual installs download.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("release", { recursive: true });
copyFileSync("apps/spotify-plugin/dist/bountiful-lyrics.js", "release/bountiful-lyrics.js");
console.log("copied to release/bountiful-lyrics.js");
