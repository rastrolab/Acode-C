// Bundles src/main.js into dist/main.js and (with --pack) zips an installable plugin.
import { build } from "esbuild";
import { zipSync } from "fflate";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pack = process.argv.includes("--pack");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, "src/main.js")],
  outfile: path.join(dist, "main.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome90"], // Android System WebView baseline
  minify: true,
  legalComments: "none",
  // web-tree-sitter & clang-format reference node built-ins only on node code paths
  external: ["fs", "path", "crypto", "child_process"],
  define: { "import.meta.url": '"file:///acode-c/"', "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
  metafile: true,
});

const mainSize = fs.statSync(path.join(dist, "main.js")).size;
console.log(`main.js ${(mainSize / 1024).toFixed(0)} KiB`);

if (pack) {
  const files = {};
  const add = (rel, src = rel) => { files[rel] = new Uint8Array(fs.readFileSync(path.join(src.startsWith("dist/") ? root : root, src))); };
  files["plugin.json"] = new Uint8Array(fs.readFileSync(path.join(root, "plugin.json")));
  files["main.js"] = new Uint8Array(fs.readFileSync(path.join(dist, "main.js")));
  files["icon.png"] = new Uint8Array(fs.readFileSync(path.join(root, "icon.png")));
  files["readme.md"] = new Uint8Array(fs.readFileSync(path.join(root, "README.md")));
  files["LICENSE"] = new Uint8Array(fs.readFileSync(path.join(root, "LICENSE")));
  files["THIRD_PARTY_NOTICES.md"] = new Uint8Array(fs.readFileSync(path.join(root, "THIRD_PARTY_NOTICES.md")));
  for (const f of manifest.files) add(f);
  void add;
  // wasm is already dense; store it without extra deflate cost, compress text.
  const entries = {};
  for (const [name, data] of Object.entries(files)) entries[name] = [data, { level: name.endsWith(".wasm") ? 6 : 9 }];
  const zip = zipSync(entries);
  const out = path.join(root, "release", "acode-c.zip");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, zip);
  console.log(`${path.relative(root, out)} ${(zip.length / 1024 / 1024).toFixed(2)} MiB (${Object.keys(files).length} files)`);
}
void result;
