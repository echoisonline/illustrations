import type { Box, SceneRole } from "./graph";
import type { Frame, LayoutCandidate } from "./layout";

type Rect = { x: number; y: number; w: number; h: number; role: SceneRole | null; id: string };

const rectOf = (item: { id: string; x: number; y: number; scale?: number }, box: Box, frame: Frame): Rect => {
  const scale = item.scale ?? 1;
  const w = box.w * scale;
  const h = box.h * scale;
  return { id: item.id, role: null, w, h, x: item.x * frame.w - w / 2, y: item.y * frame.h - h / 2 };
};

const overlap = (a: Rect, b: Rect) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x1 && y2 > y1 ? (x2 - x1) * (y2 - y1) : 0;
};

const inside = (rect: Rect, frame: Frame) => {
  const x1 = Math.max(0, rect.x);
  const y1 = Math.max(0, rect.y);
  const x2 = Math.min(frame.w, rect.x + rect.w);
  const y2 = Math.min(frame.h, rect.y + rect.h);
  return { w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1), area: Math.max(0, x2 - x1) * Math.max(0, y2 - y1) };
};

export type Judgement = {
  ok: boolean;
  /** жёсткие нарушения: такой вариант не показываем */
  violations: string[];
  score: number;
  metrics: {
    heroVisible: number;
    maxOverlap: number;
    occupancy: number;
    balance: number;
  };
};

/**
 * Проверка и оценка кандидата.
 *
 * Жёсткие ограничения (нарушил — вариант отбрасывается): главный объект
 * узнаваем, крупные предметы не перекрываются без отношения, ничего не
 * улетело далеко за кадр.
 *
 * Мягкая оценка: иерархия, баланс, заполнение кадра, отношения.
 */
export function judge(
  candidate: LayoutCandidate,
  boxes: Partial<Record<string, Box>>,
  frame: Frame,
  largeIds: Set<string>,
  heroId: string,
  /** пары, которым перекрытие разрешено отношением */
  allowed: Set<string> = new Set(),
  /** роли объектов: декор в фоне и не обязан быть виден целиком */
  roles: Record<string, SceneRole> = {},
): Judgement {
  const rects: Rect[] = [];
  const violations: string[] = [];

  for (const item of candidate.items) {
    const box = boxes[item.id];
    if (!box) continue;
    const rect = rectOf(item, box, frame);
    rects.push(rect);
    if (Math.abs(item.x) > 1.6 || Math.abs(item.y) > 1.6) violations.push("объект улетел за кадр");
  }

  const hero = rects.find((rect) => rect.id === (candidate.framing?.heroId ?? heroId));
  if (!hero) return { ok: false, violations: ["пустая сцена"], score: 0, metrics: { heroVisible: 0, maxOverlap: 0, occupancy: 0, balance: 0 } };

  const heroVisible = inside(hero, frame).area / Math.max(1, hero.w * hero.h);

  // крупные предметы не должны перекрываться; мелкие могут лежать сверху
  let maxOverlap = 0;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (!largeIds.has(a.id) || !largeIds.has(b.id)) continue;
      const pair = [a.id, b.id].sort().join("+");
      if (allowed.has(pair) || candidate.framing?.overlaps.includes(pair)) continue;
      // мелочь рядом с крупным — это деталь, а не конфликт двух больших вещей
      if (Math.min(a.w, b.w) < Math.max(a.w, b.w) * 0.55) continue;
      const share = overlap(a, b) / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
      maxOverlap = Math.max(maxOverlap, share);
    }
  }

  // в широком кадре крупный предмет неизбежно режется сверху и снизу
  const minVisible = candidate.framing?.minVisible ?? (frame.w > frame.h * 1.4 ? 0.45 : 0.6);
  if (heroVisible < minVisible) violations.push("герой почти не виден");

  // Каждый предмет должен быть виден: либо он не ушёл за кадр, либо его
  // не закрыли те, кто рисуется поверх. Иначе он формально в сцене, а глазом нет.
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (roles[rect.id] === "decor") continue;
    const inFrame = inside(rect, frame).area / Math.max(1, rect.w * rect.h);
    let covered = 0;
    for (let j = i + 1; j < rects.length; j++) {
      covered += overlap(rect, rects[j]);
    }
    // рамка предмета больше самого рисунка (в неё входит тень), поэтому
    // перекрытие по рамке завышено: требуем лишь «предмет различим»
    const openShare = Math.max(0, 1 - covered / Math.max(1, rect.w * rect.h)) * inFrame;
    if (openShare < 0.08) violations.push(`объект почти не виден: ${rect.id}`);
  }
  // Если отношение не разрешает нахлёст, крупные предметы обязаны стоять
  // раздельно: «телефон поверх наушников» — ошибка, а не композиция.
  if (maxOverlap > 0.15) violations.push("крупные предметы наехали друг на друга");

  // видимая площадь сцены и её центр масс
  let visibleArea = 0;
  let massX = 0;
  let massY = 0;
  let mass = 0;
  const union = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const rect of rects) {
    const seen = inside(rect, frame);
    visibleArea += seen.area;
    massX += (rect.x + rect.w / 2) * seen.area;
    massY += (rect.y + rect.h / 2) * seen.area;
    mass += seen.area;
    const x1 = Math.max(0, rect.x);
    const y1 = Math.max(0, rect.y);
    const x2 = Math.min(frame.w, rect.x + rect.w);
    const y2 = Math.min(frame.h, rect.y + rect.h);
    if (x2 > x1 && y2 > y1) {
      union.x0 = Math.min(union.x0, x1);
      union.y0 = Math.min(union.y0, y1);
      union.x1 = Math.max(union.x1, x2);
      union.y1 = Math.max(union.y1, y2);
    }
  }

  const occupancy = mass > 0 ? Math.min(1, visibleArea / (frame.w * frame.h)) : 0;
  const boxArea = union.x1 > union.x0 ? (union.x1 - union.x0) * (union.y1 - union.y0) : 0;
  const fill = boxArea / (frame.w * frame.h);

  const cx = mass > 0 ? massX / mass / frame.w : 0.5;
  const cy = mass > 0 ? massY / mass / frame.h : 0.5;
  const balance = 1 - Math.min(1, Math.hypot(cx - 0.5, cy - 0.52) * 2.2);

  const score =
    0.36 * Math.min(1, heroVisible) +
    0.26 * balance +
    0.22 * Math.min(1, fill * 1.25) +
    0.16 * (1 - Math.min(1, occupancy * 1.6));

  return {
    ok: violations.length === 0,
    violations,
    score,
    metrics: { heroVisible, maxOverlap, occupancy, balance },
  };
}
