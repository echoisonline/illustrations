import { formats, objectById, type Format, type Kind, type Size } from "./library";

export type Item = {
  uid: string;
  id: string;
  kind: Kind;
  /** центр объекта в долях кадра */
  x: number;
  y: number;
  rot: number;
  /** общий масштаб сцены; если не задан — считается по наибольшему объекту */
  scale?: number;
};

export function formatById(id: string): Format {
  const format = formats.find((entry) => entry.id === id);
  if (!format) throw new Error(`нет формата: ${id}`);
  return format;
}

/**
 * Холст на выходе. S — половина от L: мелкие спрайты рисуются в половинном
 * масштабе, поэтому и кадр, и файл получаются вдвое меньше.
 */
export function frameFor(format: Format, size: Size): Format {
  if (size !== "S") return format;
  return { ...format, w: Math.round(format.w / 2), h: Math.round(format.h / 2) };
}

/** Насколько всё содержимое мелкого размера меньше крупного. */
export const SIZE_RATIO = 0.7;

/** Множитель для объектов и фона: S меньше L во столько же раз. */
export function sizeRatio(size: Size): number {
  return size === "S" ? SIZE_RATIO : 1;
}

/**
 * Запасной масштаб: по самому крупному объекту. Композиция считает масштаб
 * точнее (по всему кластеру) и кладёт его в item.scale.
 */
export function sceneScale(items: Item[], format: Format, size: Size): number {
  if (!items.length) return 1;
  let maxW = 1;
  let maxH = 1;
  for (const item of items) {
    const ref = objectById.get(item.id)?.sizes[size][item.kind];
    if (!ref) continue;
    maxW = Math.max(maxW, ref.w);
    maxH = Math.max(maxH, ref.h);
  }
  const density = items.length <= 2 ? 1 : 0.9;
  // S нарисован в половинном масштабе — компенсируем размером, а не нормировкой
  return Math.min((format.w * 0.78) / maxW, (format.h * 0.78) / maxH) * density * sizeRatio(size);
}

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function uid(id: string): string {
  return `${id}-${Math.random().toString(36).slice(2, 8)}`;
}
