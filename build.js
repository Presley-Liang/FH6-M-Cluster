import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const projectRoot = process.cwd();
const distDir = resolve(projectRoot, "dist");

// Ensure dist directory
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Bundle ESM source to CJS for pkg packaging
await esbuild.build({
  absWorkingDir: projectRoot,
  entryPoints: [resolve(projectRoot, "src/index.js")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: resolve(distDir, "index.cjs"),
  banner: {
    js: "// Auto-generated CJS bundle for pkg packaging - DO NOT EDIT\nvar __dirname = require('path').dirname(__filename);",
  },
  define: {
    "import.meta.url": "undefined",
  },
});

console.log("[esbuild] bundled to dist/index.cjs");
