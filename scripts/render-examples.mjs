import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const lib = await server.ssrLoadModule("/src/domain/library/index.ts");
  const { composeFromNames } = await server.ssrLoadModule("/src/domain/compose/index.ts");
  const { backgroundFor, suggestedBackground } = await server.ssrLoadModule("/src/domain/background.ts");
  const payload = {};
  for (const object of lib.objects) {
    for (const kind of ["main", "bg"]) {
      const file = object.sizes.L[kind].file;
      payload[file] = await readFile(`assets/source/${file}`, "utf8");
    }
  }
  for (const format of lib.formats) {
    for (const kind of ["plate", "geometry"]) {
      const file = `fon/${kind}-${format.id}.svg`;
      payload[file] = await readFile(`assets/source/${file}`, "utf8");
    }
  }
  lib.putSprites(payload);
  const cases = [
    ["phone-puzzle", "Телефон и пазл", "телефон, пазл"],
    ["book-phone", "Книга и телефон", "книга, телефон"],
    ["folder-wallet", "Папка, кошелёк и монета", "папка, кошелёк, монета"],
    ["headphones-vase", "Наушники и ваза", "наушники, ваза"],
    ["wallet-lamp", "Лампа, кошелёк и монета", "лампа, кошелёк, монета"],
    ["book-puzzle", "Книга, пазл и ручка", "книга, пазл, ручка"],
  ];
  await mkdir("examples/generated", { recursive: true });
  const sections = [];
  const contact = [];
  let rowY = 110;
  for (const format of lib.formats) {
    contact.push(`<text x="32" y="${rowY}" font-size="22">${format.name} · ${format.w} × ${format.h}</text>`);
    rowY += 24;
    const cardWidth = 320;
    const cardHeight = cardWidth * format.h / format.w;
    const cards = [];
    for (const [slug, title, names] of cases) {
      const { items } = composeFromNames(names, format, "L");
      const background = backgroundFor(suggestedBackground(items), format, "L", lib.palettes.a)
        .map((layer) => `<g transform="translate(${layer.x} ${layer.y}) scale(${layer.scale})">${layer.markup}</g>`).join("");
      const shapes = items.map((item, index) => {
        const s = lib.sprite(item.id, item.kind, "L", "a", lib.palettes.a, item.tone);
        return `<g id="${item.id}-${index}" transform="translate(${item.x * format.w} ${item.y * format.h}) translate(${-s.w / 2} ${-s.h / 2})">${s.markup}</g>`;
      }).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${format.w}" height="${format.h}" viewBox="0 0 ${format.w} ${format.h}"><title>${title}</title><rect width="100%" height="100%" fill="${lib.palettes.a.bg[0]}"/>${background}${shapes}</svg>`;
      const file = `${slug}-${format.id}.svg`;
      await writeFile(`examples/generated/${file}`, svg);
      cards.push(`<figure><img src="${file}" alt="${title}"/><figcaption>${title}</figcaption></figure>`);
      const index = cards.length - 1;
      const x = 32 + (index % 3) * 344;
      const y = rowY + Math.floor(index / 3) * (cardHeight + 48);
      const nested = svg.replace(`<svg xmlns="http://www.w3.org/2000/svg" width="${format.w}" height="${format.h}"`,
        `<svg x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" overflow="hidden"`);
      contact.push(`${nested}<text x="${x}" y="${y + cardHeight + 24}" font-size="14" fill="#666">${title}</text>`);
    }
    sections.push(`<section><h2>${format.name} · ${format.w} × ${format.h}</h2><div class="grid">${cards.join("")}</div></section>`);
    rowY += 2 * (cardHeight + 48) + 48;
  }
  await writeFile("examples/generated/contact-sheet.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${rowY}" viewBox="0 0 1100 ${rowY}"><rect width="100%" height="100%" fill="#faf9f6"/><g font-family="Arial, sans-serif" fill="#242329"><text x="32" y="48" font-size="30" font-weight="bold">Шесть сцен · три формата</text>${contact.join("")}</g></svg>`);
  await writeFile("examples/generated/index.html", `<!doctype html><html lang="ru"><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Композиции по референсам</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#faf9f6;color:#242329;font:16px/1.5 system-ui}main{max-width:1100px;margin:auto}h1{font-size:28px}h2{font-size:18px;margin-top:40px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}figure{margin:0}img{display:block;width:100%}figcaption{margin-top:8px;font-size:13px;color:#666}@media(max-width:700px){.grid{grid-template-columns:repeat(2,1fr)}body{padding:16px}}</style><main><h1>Шесть сцен · три формата</h1><p>Только SVG из исходной библиотеки. Без растра и дорисовки объектов.</p>${sections.join("")}</main></html>`);
  console.log("Generated 18 SVG compositions: examples/generated/index.html");
} finally {
  await server.close();
}
