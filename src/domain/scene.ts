import { formats, type Format, type Kind, type Size } from "./library";

export type Item = {
  uid: string;
  id: string;
  kind: Kind;
  tone?: "warm";
  /** центр объекта в долях кадра */
  x: number;
  y: number;
  rot: number;
  /** масштаб сцены: всегда 1, предметы стоят в нарисованном размере */
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

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function uid(id: string): string {
  return `${id}-${Math.random().toString(36).slice(2, 8)}`;
}
