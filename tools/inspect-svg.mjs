import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
for (const name of readdirSync(dir).filter((file) => file.endsWith(".svg"))) {
  const text = readFileSync(join(dir, name), "utf8");
  const root = text.match(/<svg[^>]*>/i)?.[0] ?? "";
  const fills = [...text.matchAll(/fill="(#[0-9a-fA-F]{3,8}|white)"/g)].map((match) => match[1].toLowerCase());
  const uniq = [...new Set(fills)];
  console.log(
    [
      name,
      `${(text.length / 1024).toFixed(1)}кб`,
      root.match(/width="[^"]*"/)?.[0],
      root.match(/height="[^"]*"/)?.[0],
      root.match(/viewBox="[^"]*"/)?.[0],
      `путей: ${(text.match(/<path/g) ?? []).length}`,
      `цвета: ${uniq.slice(0, 6).join(" ")}`,
    ].join(" · "),
  );
}
