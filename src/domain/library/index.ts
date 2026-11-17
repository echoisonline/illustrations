import manifestJson from "./manifest.json";
import { contentBox } from "./measure";

export type Size = "L" | "S";
export type Scheme = "a" | "b" | "c";
export type Kind = "main" | "bg";
export type FormatId = "square" | "wide" | "tall";

export type SpriteRef = { file: string; w: number; h: number };
export type LibraryObject = {
  id: string;
  name: string;
  sizes: Record<Size, Record<Kind, SpriteRef>>;
};
export type Palette = {
  name: string;
  bg: [string, string, string];
  ink: string;
  obj: [string, string, string];
  white: string;
};
export type Format = { id: FormatId; name: string; w: number; h: number };

type Manifest = {
  objects: LibraryObject[];
  backgrounds: Record<Scheme, Record<Size, string>>;
  palettes: Record<Scheme, Palette>;
  formats: Format[];
};

export const manifest = manifestJson as Manifest;
export const objects = manifest.objects;
export const palettes = manifest.palettes;
export const formats = manifest.formats;
export const objectById = new Map(objects.map((o) => [o.id, o]));

/** Разметка SVG хранится вне бандла и загружается по одному файлу из public/sprites. */
const raw = new Map<string, string>();
const failed = new Set<string>();
const asked = new Map<string, Promise<void>>();

/** Для тестов: спрайты читаются с диска и складываются сюда целиком. */
export function putSprites(payload: Record<string, string>): void {
  for (const [file, text] of Object.entries(payload)) {
    raw.set(file, text.replace(/\r\n/g, "\n"));
  }
}

export function hasSprite(file: string): boolean {
  return raw.has(file);
}

export function spriteText(file: string): string {
  const text = raw.get(file);
  if (!text) throw new Error(`нет SVG: ${file}`);
  return text;
}

/**
 * Догружает недостающие спрайты. Файлы лежат в public/sprites и берутся по
 * одному, поэтому сцена не ждёт всю библиотеку. Повторный вызов того же файла
 * не делает второй запрос.
 */
export function ensureSprites(files: string[]): Promise<void> {
  const missing = files.filter((file) => file && !raw.has(file) && !failed.has(file));
  const pending = missing.map((file) => {
    const known = asked.get(file);
    if (known) return known;

    const request = fetch(`${import.meta.env.BASE_URL}sprites/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then((text) => {
        raw.set(file, text.replace(/\r\n/g, "\n"));
      })
      .catch(() => {
        // нет файла — помечаем, чтобы не просить его снова каждый кадр
        failed.add(file);
      })
      .finally(() => {
        asked.delete(file);
      });

    asked.set(file, request);
    return request;
  });

  return Promise.all(pending).then(() => undefined);
}

export function stripRoot(svg: string): string {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/i);
  return (match ? match[1] : svg).trim();
}

const hex = (value: string) => value.replace("#", "").padEnd(6, "0");

/** Смешать два цвета: нужен отдельный тон для монохромных объектов. */
function mix(from: string, to: string, t: number): string {
  if (!from.startsWith("#") || !to.startsWith("#")) return from;
  const a = hex(from);
  const b = hex(to);
  const channel = (i: number) => {
    const x = parseInt(a.slice(i, i + 2), 16);
    const y = parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** Один проход по всем цветам сразу: роль → цвет целевой палитры. */
export function recolor(markup: string, target: Palette, kind: Kind): string {
  const pairs: Array<[string, string]> = [];

  // Монохромные предметы сохраняют заливку поля и акцентные контуры библиотеки.
  const field = target.bg[0];
  const plane = target.bg[1];

  // исходники нарисованы в разных схемах (объекты — в A, подложка-плоскость — в B),
  // поэтому источником считаем все базовые палитры сразу
  for (const base of Object.values(palettes)) {
    if (kind !== "bg") {
      pairs.push([base.bg[0], target.bg[0]], [base.bg[1], target.bg[1]], [base.bg[2], target.bg[2]]);
      pairs.push(
        [base.ink, target.ink],
        [base.obj[0], target.obj[0]],
        [base.obj[1], target.obj[1]],
        [base.obj[2], target.obj[2]],
        [base.white, target.white],
      );
    } else {
      pairs.push([base.bg[0], field], [base.bg[1], plane], [base.bg[2], target.bg[2]]);
      pairs.push([base.white, mix(target.white, target.bg[2], 0.08)]);
    }
  }

  const map = new Map(pairs.filter(([from, to]) => from.toLowerCase() !== to.toLowerCase()));
  if (!map.size) return markup;
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${keys.join("|")})`, "gi");
  return markup.replace(re, (m) => map.get(m.toLowerCase()) ?? m);
}

const spriteCache = new Map<string, { markup: string; w: number; h: number }>();
const SPRITE_CACHE_LIMIT = 128;

export function sprite(id: string, kind: Kind, size: Size, paletteKey: string | undefined, target: Palette, tone?: "warm") {
  // Черновое превью не должно оставаться в глобальном кэше после закрытия диалога.
  const cacheable = paletteKey !== undefined;
  const colors = [target.bg, target.ink, target.obj, target.white];
  const key = `${id}:${kind}:${size}:${JSON.stringify(colors)}:${tone ?? ""}`;
  const cached = cacheable ? spriteCache.get(key) : undefined;
  if (cached) {
    spriteCache.delete(key);
    spriteCache.set(key, cached);
    return cached;
  }

  const object = objectById.get(id);
  if (!object) throw new Error(`нет объекта: ${id}`);
  const ref = object.sizes[size][kind];
  const source = stripRoot(spriteText(ref.file));
  const markup = tone === "warm" && kind === "main"
    ? source.replace(/#d7cdf5|#f9ecb0/gi, (color) => color.toLowerCase() === "#d7cdf5" ? palettes.a.obj[0] : palettes.a.obj[1])
    : source;
  const value = { markup: recolor(markup, target, kind), w: ref.w, h: ref.h };
  if (cacheable) {
    spriteCache.set(key, value);
    if (spriteCache.size > SPRITE_CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  }
  return value;
}

/** Подложка из исходников: конфетти и линии. */
export const PLATES = {
  confetti: "Фон.svg",
} as const;

export type PlateKind = keyof typeof PLATES;

/** Подложка из макета, перекрашенная в текущую палитру. */
export function plate(kind: PlateKind, size: Size, target: Palette) {
  const text = spriteText(`${size}/${PLATES[kind]}`);
  const width = Number(text.match(/<svg[^>]*width="([\d.]+)"/i)?.[1] ?? (size === "L" ? 1000 : 500));
  const height = Number(text.match(/<svg[^>]*height="([\d.]+)"/i)?.[1] ?? (size === "L" ? 1000 : 500));
  return plateFromText(`plate:${kind}:${size}`, text, width, height, target);
}
/**
 * Подложка, нарисованная под конкретный формат: `fon/plate-wide.svg`
 * или `fon/geometry-tall.svg`. Если файла нет — вызывающий код берёт общую.
 */
export function formatPlate(kind: PlateKindId, formatId: string, size: Size, target: Palette) {
  const key = [`fon/${kind}-${formatId}.svg`, `fon/${kind}-${formatId}-${size}.svg`].find((candidate) => raw.has(candidate));
  if (!key) return null;
  const text = raw.get(key)!;
  const width = Number(text.match(/<svg[^>]*width="([\d.]+)"/i)?.[1] ?? 1000);
  const height = Number(text.match(/<svg[^>]*height="([\d.]+)"/i)?.[1] ?? 1000);
  return { ...plateFromText(`format:${key}`, text, width, height, target), key };
}

export type PlateKindId = "plate" | "geometry";

/**
 * Общая чистка подложки: лишние defs, клипы и плашка во весь лист.
 * Плашку убираем всегда — цвет кадра рисует сама сцена отдельным rect,
 * иначе при уменьшении фона её обрез получался бы видимым.
 */
function plateFromText(cacheKey: string, text: string, width: number, height: number, target: Palette) {
  const markup = recolor(
    stripRoot(text)
      .replace(/<defs[\s\S]*?<\/defs>/gi, "")
      .replace(/\sclip-path="url\([^)]*\)"/gi, "")
      .replace(
        new RegExp(
          `<rect[^>]*width="${width}"[^>]*height="${height}"[^>]*fill="(#fff{0,3}|white|#d7cdf5)"[^>]*/?>`,
          "gi",
        ),
        "",
      ),
    target,
    "main",
  );

  // фигуры подложки нарисованы за пределами её viewBox — берём реальные границы
  const box = contentBox(`${cacheKey}:${target.name}:${markup.length}`, markup, width, height);
  return { markup, box, w: width, h: height };
}
