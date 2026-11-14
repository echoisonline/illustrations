import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSprites } from "./domain/library";

/**
 * В тестах спрайты берём из собранного файла: приложение грузит его запросом,
 * а node-окружение читает с диска. Перед прогоном файл готовит prebuild.
 */
const payload = JSON.parse(readFileSync(join(process.cwd(), "public", "sprites.json"), "utf8")) as Record<
  string,
  string
>;
loadSprites(payload);
