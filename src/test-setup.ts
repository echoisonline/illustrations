import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { putSprites } from "./domain/library";

/**
 * В тестах спрайты читаем прямо из assets/source: приложение грузит их по сети,
 * а node-окружение берёт с диска.
 */
const source = join(process.cwd(), "assets", "source");

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : entry.endsWith(".svg") ? [full] : [];
  });
}

const payload: Record<string, string> = {};
for (const file of walk(source)) {
  payload[relative(source, file).split("\\").join("/")] = readFileSync(file, "utf8");
}
putSprites(payload);