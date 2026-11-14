#!/usr/bin/env node
/**
 * Копирует исходные SVG в public/sprites: приложение грузит их по одному, а не
 * тянет всю библиотеку в JavaScript. Имена и структура папок сохраняются.
 *
 *   node tools/build-sprites.mjs   → public/sprites/**
 */
import { cpSync, readdirSync, rmSync, statSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets", "source");
const output = join(root, "public", "sprites");

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.toLowerCase().endsWith(".svg")) files.push(full);
  }
  return files;
}

rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });

const files = walk(output);
const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
const largest = files
  .map((file) => ({ file: relative(output, file), size: statSync(file).size }))
  .sort((a, b) => b.size - a.size)[0];

console.log(
  `${files.length} файлов, ${(bytes / 1024).toFixed(0)} КБ в public/sprites; самый крупный — ${largest.file} (${(largest.size / 1024).toFixed(0)} КБ)`,
);
void readFileSync;
