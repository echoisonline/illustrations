#!/usr/bin/env node
/**
 * Собирает исходные SVG в один файл вне бандла: так разметка не попадает
 * в JavaScript, грузится отдельным запросом и кэшируется браузером.
 *
 *   node tools/build-sprites.mjs   → public/sprites.json
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets", "source");
const output = join(root, "public", "sprites.json");

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.toLowerCase().endsWith(".svg")) files.push(full);
  }
  return files;
}

const sprites = {};
let bytes = 0;

for (const file of walk(source)) {
  const key = relative(source, file).split("\\").join("/");
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  sprites[key] = text;
  bytes += Buffer.byteLength(text, "utf8");
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(sprites), "utf8");

const size = statSync(output).size;
console.log(
  `${Object.keys(sprites).length} спрайтов, ${(bytes / 1024 / 1024).toFixed(2)} МБ разметки → public/sprites.json (${(size / 1024).toFixed(0)} КБ)`,
);
