// Разбор выгрузки из Figma в манифест библиотеки.
// Вход: assets/source/L/*.svg, assets/source/S/*.svg (как их сохранил Figma)
// Выход: src/domain/library/manifest.json
//
// Классификация без ручных списков: состояние (main/bg) — по цветам, объект — по
// пропорциям и имени, подложка схемы — по цвету фона.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "assets/source";
const OUT = "src/domain/library/manifest.json";

const INK = "#181817";
const BG_SLOTS = {
  a: ["#d7cdf5", "#aa9bf0", "#7864d7"],
  b: ["#fdd7b9", "#fac896", "#d27532"],
  c: ["#beebeb", "#80dada", "#5abebe"],
};
const PALETTES = {
  a: { name: "лаванда", bg: BG_SLOTS.a, ink: INK, obj: ["#f9ecb0", "#f9a3aa", "#ffe3e1"], white: "#ffffff" },
  b: { name: "персик", bg: BG_SLOTS.b, ink: INK, obj: ["#f9ecb0", "#80dada", "#beebeb"], white: "#ffffff" },
  c: { name: "мята", bg: BG_SLOTS.c, ink: INK, obj: ["#ffd4f2", "#6d7bfc", "#b6c6fe"], white: "#ffffff" },
};

// пропорция (w/h) → объект; снята с исходного файла Figma
const BY_RATIO = [
  { id: "vaza", ar: 0.791 },
  { id: "kniga", ar: 1.481 },
  { id: "telefon", ar: 1.724 },
  { id: "pazl", ar: 1.732 },
  { id: "moneta", ar: 1.52 },
  { id: "naushniki", ar: 1.283 },
  { id: "lampa", ar: 0.838 },
  { id: "koshelek", ar: 1.591 },
  { id: "ruchka", ar: 1.779 },
  { id: "papka", ar: 1.883 },
];
const NAME_BY_ID = {
  kniga: "Книга",
  telefon: "Телефон",
  pazl: "Пазл",
  moneta: "Монета",
  naushniki: "Наушники",
  lampa: "Лампа",
  koshelek: "Кошелёк",
  ruchka: "Ручка",
  papka: "Папка",
  vaza: "Ваза",
};

function parse(path) {
  const text = readFileSync(path, "utf8");
  const tag = text.match(/<svg[^>]*>/i)?.[0] ?? "";
  const num = (n) => Number(tag.match(new RegExp(`${n}="([\\d.]+)"`, "i"))?.[1] ?? 0);
  const colors = [...new Set([...text.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1].toLowerCase()))];
  return { w: Math.round(num("width")), h: Math.round(num("height")), colors, text };
}

const MANIFEST = { objects: [], backgrounds: { a: {}, b: {}, c: {} }, palettes: PALETTES };
const found = { L: {}, S: {} };
const skipped = [];

for (const size of ["L", "S"]) {
  const dir = join(SRC, size);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
    const svg = parse(join(dir, file));
    const ar = svg.w / svg.h;
    const isInk = svg.colors.includes(INK);

    // подложки схем
    if (/^Фон/.test(file)) {
      const scheme = Object.entries(BG_SLOTS).find(([, slots]) => slots.every((c) => svg.colors.includes(c)))?.[0];
      if (!scheme || svg.w !== svg.h) { skipped.push(`${size}/${file} (фон)`); continue; }
      MANIFEST.backgrounds[scheme][size] = `${size}/${file}`;
      continue;
    }
    // карточки палитр: 7 цветов и характерная пропорция
    if (svg.colors.length >= 6) { skipped.push(`${size}/${file} (карточка палитры)`); continue; }
    // текстовые ярлыки
    if (!/^(Книга|Телефон|Пазлы|Монета|Наушники|Лампа|Кошелек|Ручка|Папка|Group)/.test(file)) {
      skipped.push(`${size}/${file} (не объект)`);
      continue;
    }

    const byName = {
      Книга: "kniga", Телефон: "telefon", Пазлы: "pazl", Монета: "moneta",
      Наушники: "naushniki", Лампа: "lampa", Кошелек: "koshelek",
      Ручка: "ruchka", Папка: "papka",
    }[file.replace(/-\d+\.svg$/, ".svg")];
    const id = byName ?? BY_RATIO.slice().sort((x, y) => Math.abs(x.ar - ar) - Math.abs(y.ar - ar))[0].id;

    found[size][id] ??= {};
    const kind = isInk ? "main" : "bg";
    if (found[size][id][kind]) skipped.push(`${size}/${file} (дубль ${id}/${kind})`);
    else found[size][id][kind] = { file: `${size}/${file}`, w: svg.w, h: svg.h };
  }
}

for (const id of Object.keys(NAME_BY_ID)) {
  const sizes = {};
  for (const size of ["L", "S"]) {
    const entry = found[size][id];
    if (!entry?.main) { console.warn(`нет main для ${id}/${size}`); continue; }
    sizes[size] = { main: entry.main, bg: entry.bg ?? entry.main };
  }
  if (Object.keys(sizes).length) MANIFEST.objects.push({ id, name: NAME_BY_ID[id], sizes });
}

MANIFEST.formats = [
  { id: "square", name: "квадрат", w: 1000, h: 1000 },
  { id: "wide", name: "широкий", w: 1200, h: 630 },
  { id: "tall", name: "вертикальный", w: 800, h: 1200 },
];
MANIFEST.modes = [
  { id: "collected", name: "собрано" },
  { id: "offset", name: "со смещением" },
  { id: "headline", name: "под заголовок" },
];

writeFileSync(OUT, JSON.stringify(MANIFEST, null, 2));
console.log(`объектов: ${MANIFEST.objects.length}`);
for (const o of MANIFEST.objects) console.log(`  ${o.id.padEnd(10)} L ${o.sizes.L.main.w}×${o.sizes.L.main.h}  S ${o.sizes.S?.main.w}×${o.sizes.S?.main.h}`);
console.log(`подложки: ${JSON.stringify(Object.fromEntries(Object.entries(MANIFEST.backgrounds).map(([k, v]) => [k, Object.keys(v).join("/")])))}`);
if (skipped.length) console.log(`пропущено (${skipped.length}): ${skipped.join(", ")}`);
