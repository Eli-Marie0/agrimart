// Export every documentation SVG to PNG using the `sharp` already installed in agrimart-api.
// Run:  node docs/export-png.mjs
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const OUT = dirname(fileURLToPath(import.meta.url));
const PNG_DIR = join(OUT, "png");
mkdirSync(PNG_DIR, { recursive: true });

const require = createRequire(join(OUT, "..", "agrimart-api", "node_modules", "x.js"));
const sharp = require("sharp");

const SCALE = 2; // 2x for crisp print/Word embedding

function collect(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "png") continue;
      collect(full, acc);
    } else if (name.toLowerCase().endsWith(".svg")) {
      acc.push(full);
    }
  }
  return acc;
}

const files = collect(OUT);
let ok = 0;

for (const file of files) {
  const rel = file.slice(OUT.length + 1).replace(/\\/g, "-").replace(/\.svg$/i, ".png");
  const dest = join(PNG_DIR, rel);
  const svg = readFileSync(file);
  try {
    const meta = await sharp(svg).metadata();
    await sharp(svg, { density: 96 * SCALE })
      .resize({ width: Math.round((meta.width || 1200) * SCALE), fit: "inside" })
      .png({ compressionLevel: 9 })
      .toFile(dest);
    ok += 1;
    console.log(`ok  ${rel}  (${meta.width}x${meta.height} -> ${Math.round((meta.width || 0) * SCALE)}px wide)`);
  } catch (err) {
    console.error(`FAIL ${basename(file)}: ${err.message}`);
  }
}

console.log(`\nExported ${ok}/${files.length} PNGs to docs/png/`);
