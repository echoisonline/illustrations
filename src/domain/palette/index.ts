import type { Palette } from "../library";

export type ParseResult = { palette?: Palette; errors: string[] };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Относительная яркость для проверки контраста. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function normalize(hex: string): string {
  const value = hex.trim().toLowerCase();
  if (!HEX.test(value)) return value;
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value;
}

/**
 * Палитра приходит либо JSON-объектом (как в манифесте), либо строкой из 8 цветов:
 * три фона, цвет линий, три цвета объектов, белый.
 */
export function parsePalette(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { errors: ["пусто"] };

  let data: Record<string, unknown>;
  if (text.startsWith("{")) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { errors: ["json не читается"] };
    }
  } else {
    const colors = text.split(/[\s,;]+/).filter(Boolean).map(normalize);
    if (colors.length !== 8) return { errors: [`нужно 8 цветов, пришло ${colors.length}`] };
    data = {
      name: "своя",
      bg: colors.slice(0, 3),
      ink: colors[3],
      obj: colors.slice(4, 7),
      white: colors[7],
    };
  }

  const errors: string[] = [];
  const pick = (value: unknown, index?: number): string => {
    if (index === undefined) return typeof value === "string" ? normalize(value) : "";
    return Array.isArray(value) && typeof value[index] === "string" ? normalize(value[index] as string) : "";
  };

  const palette: Palette = {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 24) : "своя",
    bg: [pick(data.bg, 0), pick(data.bg, 1), pick(data.bg, 2)],
    ink: pick(data.ink),
    obj: [pick(data.obj, 0), pick(data.obj, 1), pick(data.obj, 2)],
    white: pick(data.white) || "#ffffff",
  };

  const all = [...palette.bg, palette.ink, ...palette.obj, palette.white];
  if (all.some((color) => !HEX.test(color))) errors.push("не все цвета в hex");
  if (new Set(all).size < 3) errors.push("слишком мало разных цветов");
  if (errors.length) return { errors };

  if (contrast(palette.ink, palette.bg[0]) < 3) {
    errors.push("низкий контраст линий к фону");
  }

  return { palette, errors };
}

export function paletteSignature(palette: Palette): string {
  return [palette.bg.join(""), palette.ink, palette.obj.join(""), palette.white].join("|");
}

export const paletteTemplate = `{
  "name": "своя",
  "bg": ["#d7cdf5", "#aa9bf0", "#7864d7"],
  "ink": "#181817",
  "obj": ["#f9ecb0", "#f9a3aa", "#ffe3e1"],
  "white": "#ffffff"
}`;
