import type { Format, Palette, Size } from "./library";
import { formatPlate, plate, type PlateKindId } from "./library";

/** Фон композиции: подложка, геометрия или чистый цвет схемы. */
export type BackgroundVariant = PlateKindId | "flat";

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
export function backgroundFor(
  variant: BackgroundVariant,
  format: Format,
  size: Size,
  palette: Palette,
): BackgroundLayer[] {
  if (variant === "flat") return [];

  const artwork =
    formatPlate(variant, format.id, size, palette) ??
    (variant === "plate" ? plate("confetti", size, palette) : null);
  if (!artwork) return [];

  // отдельного ассета под S нет: лист 1000×1000 просто вписываем в кадр 500×500,
  // как и в крупном размере — рисунок ложится по кромкам без обрезки
  const scale = Math.max(format.w / artwork.w, format.h / artwork.h);

  return [
    {
      kind: "plate",
      markup: artwork.markup,
      scale,
      x: (format.w - artwork.w * scale) / 2,
      y: (format.h - artwork.h * scale) / 2,
      opacity: 1,
    },
  ];
}
