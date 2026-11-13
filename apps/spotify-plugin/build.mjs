import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  charset: "utf8",
  legalComments: "none",
  loader: { ".woff2": "dataurl" },
  outfile: "dist/bountiful-lyrics.js",
});
console.log("built dist/bountiful-lyrics.js");
