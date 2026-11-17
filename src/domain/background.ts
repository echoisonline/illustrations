import type { Item } from "./scene";
import type { Format, Palette, Size } from "./library";
import { formatPlate, hasSprite, plate, type PlateKindId } from "./library";

/** Фон композиции: подложка, геометрия или чистый цвет схемы. */
export type BackgroundVariant = PlateKindId | "flat";

export function suggestedBackground(items: Item[]): BackgroundVariant {
  return items.some((item) => item.id === "telefon") && !items.some((item) => item.id === "kniga") ||
    items.some((item) => item.id === "naushniki") ? "plate" : "geometry";
}

export type BackgroundLayer = {
  kind: "plate";
  markup: string;
  scale: number;
  x: number;
  y: number;
  opacity: number;
};

/**
 * Подложка под кадр: сначала файл, нарисованный под этот формат
 * (fon/plate-wide.svg), иначе общая подложка из макета.
 */
/** Подложка не зависит от того, что происходит со сценой: кэшируем результат. */
const backgroundCache = new Map<string, BackgroundLayer[]>();
const BACKGROUND_CACHE_LIMIT = 24;

const paletteKey = (palette: Palette) =>
  [palette.bg.join(""), palette.ink, palette.obj.join(""), palette.white].join("|");

export function backgroundFor(
  variant: BackgroundVariant,
  format: Format,
  size: Size,
  palette: Palette,
): BackgroundLayer[] {
  if (variant === "flat") return [];

  const key = `${variant}|${format.id}|${format.w}x${format.h}|${size}|${paletteKey(palette)}`;
  const cached = backgroundCache.get(key);
  if (cached) return cached;

  // файла может ещё не быть в памяти: тогда подложки просто нет, а загрузку
  // заказывает холст — иначе здесь был бы синхронный бросок
  const artwork =
    formatPlate(variant, format.id, size, palette) ??
    (variant === "plate" && hasSprite(`${size}/Фон.svg`) ? plate("confetti", size, palette) : null);
  if (!artwork) return [];

  // отдельного ассета под S нет: лист 1000×1000 просто вписываем в кадр 500×500,
  // как и в крупном размере — рисунок ложится по кромкам без обрезки
  const scale = Math.max(format.w / artwork.w, format.h / artwork.h);

  const layers: BackgroundLayer[] = [
    {
      kind: "plate",
      markup: artwork.markup,
      scale,
      x: (format.w - artwork.w * scale) / 2,
      y: (format.h - artwork.h * scale) / 2,
      opacity: 1,
    },
  ];

  if (backgroundCache.size >= BACKGROUND_CACHE_LIMIT) backgroundCache.clear();
  backgroundCache.set(key, layers);
  return layers;
}
