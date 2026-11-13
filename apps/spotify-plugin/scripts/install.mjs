// Copies the built extension into Spicetify and enables it. Pass -n to skip restarting Spotify.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NAME = "bountiful-lyrics.js";
const run = (...args) => execFileSync("spicetify", args, { encoding: "utf8" }).trim();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const userdata = run("path", "userdata");
const target = join(userdata, "Extensions");
mkdirSync(target, { recursive: true });
copyFileSync(join(root, "dist", NAME), join(target, NAME));
console.log(`copied to ${join(target, NAME)}`);

const config = readFileSync(join(userdata, "config-xpui.ini"), "utf8");
const line = config.split(/\r?\n/).find((l) => /^extensions\s*=/.test(l)) ?? "";
if (!line.includes(NAME)) run("config", "extensions", NAME);

const passthrough = process.argv.slice(2).filter((a) => a === "-n");
execFileSync("spicetify", ["apply", ...passthrough], { stdio: "ignore" });
console.log("applied");
