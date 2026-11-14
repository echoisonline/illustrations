/**
 * Реальные границы рисунка внутри SVG: у выгрузок из Figma вокруг объекта
 * есть прозрачные поля, из-за которых объекты «висят» и плитка выглядит рваной.
 * Меряем один раз на спрайт и кэшируем.
 */
export type Box = { x: number; y: number; w: number; h: number };

const cache = new Map<string, Box>();

export function contentBox(key: string, markup: string, width: number, height: number): Box {
  const cached = cache.get(key);
  if (cached) return cached;

  const fallback: Box = { x: 0, y: 0, w: width, h: height };
  if (typeof document === "undefined") return fallback;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none";

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.innerHTML = markup;
  svg.appendChild(group);
  document.body.appendChild(svg);

  let box = fallback;
  try {
    const measured = group.getBBox();
    if (measured.width > 0 && measured.height > 0) {
      box = { x: measured.x, y: measured.y, w: measured.width, h: measured.height };
    }
  } finally {
    svg.remove();
  }

  cache.set(key, box);
  return box;
}

/** viewBox по содержимому с небольшим полем. */
export function contentViewBox(box: Box, pad = 0.04): string {
  const dx = box.w * pad;
  const dy = box.h * pad;
  return `${box.x - dx} ${box.y - dy} ${box.w + dx * 2} ${box.h + dy * 2}`;
}
