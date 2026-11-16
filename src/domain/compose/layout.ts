import type { FormatId, Kind } from "../library";
import { uid, type Item } from "../scene";
import type { Box, Relation, ScenePlan, SceneRole } from "./graph";

export type Frame = { w: number; h: number };

export type LayoutCandidate = {
  pattern: string;
  mirror: boolean;
  items: Item[];
};

type RoleBoxes = Partial<Record<SceneRole, Box>>;

type PatternContext = {
  frame: Frame;
  format: FormatId;
  boxes: RoleBoxes;
  relation: Relation | null;
  mirror: boolean;
};

type Spot = { role: SceneRole; x: number; y: number };

type Pattern = {
  id: string;
  /** что паттерн выражает — это же уходит в подсказку модели */
  about: string;
  fits: (ctx: PatternContext) => boolean;
  build: (ctx: PatternContext) => Spot[];
  /** порядок отрисовки: от дальнего к ближнему */
  order: SceneRole[];
};

/** Центр объекта по доле кадра. */
const at = (x: number, y: number) => ({ x, y });

/** Поставить объект так, чтобы его нижняя кромка была на заданной доле кадра. */
const bottomAt = (frame: Frame, box: Box, x: number, bottom: number) =>
  at(x, (frame.h * bottom - box.h / 2) / frame.h);

/**
 * Главный объект: если он выше кадра (книга в горизонтали), его сажаем
 * по центру — иначе видна только четверть и предмет не узнаётся.
 */
const heroAt = (frame: Frame, box: Box, x: number) =>
  box.h > frame.h * 0.95 ? at(x, 0.5) : bottomAt(frame, box, x, 0.94);

/**
 * Декор уходит в верхнюю часть кадра: нижняя кромка на 0.34 высоты, поэтому
 * лампа не садится на главный предмет, а уходит за ним.
 */
const decorSpot = (frame: Frame, box: Box, x: number) =>
  at(x, (frame.h * 0.34 - box.h / 2) / frame.h);

const PATTERNS: Pattern[] = [
  {
    id: "взаимодействие",
    about: "второй предмет лежит на главном: телефон на книге, ручка на папке",
    fits: (ctx) => Boolean(ctx.boxes.support) && ctx.relation === "on",
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const side = mirror ? -1 : 1;
      const hero = heroAt(frame, boxes.hero!, 0.5);
      const support = at(hero.x + 0.02 * side, hero.y - 0.06);
      const spots: Spot[] = [{ role: "hero", ...hero }, { role: "support", ...support }];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.22 : 0.78) });
      // деталь лежит на герое, но с противоположной от поддержки стороны:
      // третьим ярусом поверх поддержки — это уже башня
      if (boxes.detail) spots.push({ role: "detail", ...at(hero.x - 0.1 * side, hero.y - 0.02) });
      return spots;
    },
    order: ["decor", "hero", "support", "detail"],
  },
  {
    id: "соседство",
    about: "два самостоятельных предмета стоят рядом, как кошелёк и монета",
    fits: (ctx) => Boolean(ctx.boxes.support),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const gap = frame.w * 0.03;
      const heroX = mirror ? 0.42 : 0.58;
      const hero = heroAt(frame, boxes.hero!, heroX);
      const heroBox = boxes.hero!;
      const supportBox = boxes.support!;
      const dir = mirror ? 1 : -1;
      const total = (heroBox.w + supportBox.w) / frame.w;
      const spread = dir * (total > 0.9 ? 0.24 : total / 2 + gap / frame.w);
      const support = bottomAt(frame, supportBox, heroX + spread, 0.94);
      const spots: Spot[] = [{ role: "hero", ...hero }, { role: "support", ...support }];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.8 : 0.2) });
      if (boxes.detail) {
        spots.push({ role: "detail", ...bottomAt(frame, boxes.detail, mirror ? 0.16 : 0.84, 0.98) });
      }
      return spots;
    },
    order: ["decor", "hero", "support", "detail"],
  },
  {
    id: "диагональ",
    about: "главный внизу слева, второй уходит вглубь вправо вверх",
    // у этой позы нет места детали: если деталь названа, поза не подходит
    fits: (ctx) => Boolean(ctx.boxes.support) && !ctx.boxes.detail,
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const heroX = mirror ? 0.62 : 0.38;
      const hero = heroAt(frame, boxes.hero!, heroX);
      const far = mirror ? -1 : 1;
      const support = at(hero.x + 0.26 * far, Math.max(0.18, hero.y - 0.18));
      const spots: Spot[] = [{ role: "hero", ...hero }, { role: "support", ...support }];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.24 : 0.76) });
      return spots;
    },
    order: ["decor", "support", "hero"],
  },
  {
    id: "вертикаль",
    about: "предмет под предметом, кадр держится на вертикальной оси",
    // только для вертикального кадра: в квадрате это читается как парящий предмет
    // если предмет можно положить на другой, ставить его отдельно сверху незачем
    fits: (ctx) => ctx.format === "tall" && Boolean(ctx.boxes.support) && ctx.relation !== "on",
    build: (ctx) => {
      const { boxes, frame } = ctx;
      const hero = bottomAt(frame, boxes.hero!, 0.5, 0.96);
      const supportBox = boxes.support!;
      // второй предмет слегка наезжает на верх первого: рамка картинки шире
      // рисунка (тень), и без нахлёста предмет читается как парящий
      const heroHeight = boxes.hero!.h / frame.h;
      const supportTop = 0.96 - heroHeight + heroHeight * 0.28;
      const spots: Spot[] = [{ role: "hero", ...hero }];
      if (supportTop > 0.05) spots.push({ role: "support", ...bottomAt(frame, supportBox, 0.5, supportTop) });
      if (boxes.detail) spots.push({ role: "detail", ...at(0.22, 0.16) });
      return spots;
    },
    order: ["support", "hero", "detail"],
  },
  {
    id: "край",
    about: "второй предмет уходит за кромку кадра и работает глубиной",
    fits: (ctx) => Boolean(ctx.boxes.support),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const side = mirror ? -1 : 1;
      const hero = heroAt(frame, boxes.hero!, mirror ? 0.54 : 0.46);
      // поддержку выводим за кромку: видна половина, но она читается
      const support = bottomAt(frame, boxes.support!, 0.5 + side * 0.62, 0.9);
      const spots: Spot[] = [
        { role: "hero", ...hero },
        { role: "support", ...support },
      ];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.18 : 0.82) });
      if (boxes.detail) spots.push({ role: "detail", ...at(hero.x - 0.08 * side, hero.y - 0.1) });
      return spots;
    },
    order: ["decor", "hero", "support", "detail"],
  },
  {
    id: "наплыв",
    about: "второй предмет надвигается на главный снизу и приоткрывает его",
    fits: (ctx) => Boolean(ctx.boxes.support),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const side = mirror ? -1 : 1;
      const hero = heroAt(frame, boxes.hero!, 0.5);
      // Нахлёст читается как «перед», только если предмет ниже по экрану.
      // Тот же нахлёст сверху выглядит как «лежит на», а это другая история.
      const support = at(hero.x + 0.17 * side, hero.y + 0.09);
      const spots: Spot[] = [
        { role: "hero", ...hero },
        { role: "support", ...support },
      ];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.2 : 0.8) });
      if (boxes.detail) spots.push({ role: "detail", ...at(hero.x - 0.12 * side, hero.y - 0.12) });
      return spots;
    },
    order: ["decor", "hero", "support", "detail"],
  },
  {
    id: "второй план",
    about: "главный внизу справа, второй крупный — обрезанный в левом верхнем углу",
    fits: (ctx) => Boolean(ctx.boxes.support),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const hero = heroAt(frame, boxes.hero!, mirror ? 0.38 : 0.62);
      const support = bottomAt(frame, boxes.support!, mirror ? 0.84 : 0.16, 0.56);
      const spots: Spot[] = [
        { role: "hero", ...hero },
        { role: "support", ...support },
      ];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.14 : 0.86) });
      if (boxes.detail) spots.push({ role: "detail", ...at(hero.x + (mirror ? -0.1 : 0.1), hero.y - 0.12) });
      return spots;
    },
    order: ["support", "decor", "hero", "detail"],
  },  {
    id: "угол",
    about: "главный в правом нижнем углу, вокруг него воздух и мелкая деталь",
    fits: (ctx) => Boolean(ctx.boxes.detail),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const hero = heroAt(frame, boxes.hero!, mirror ? 0.38 : 0.62);
      const spots: Spot[] = [{ role: "hero", ...hero }];
      // деталь — на самом герое, а не в пустом углу кадра: иначе она висит
      if (boxes.detail) spots.push({ role: "detail", ...at(hero.x + (mirror ? -0.09 : 0.09), hero.y - 0.1) });
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.84 : 0.16) });
      return spots;
    },
    order: ["decor", "hero", "detail"],
  },
  {
    id: "парад",
    about: "два предмета по краям, между ними воздух и мелкая деталь",
    fits: (ctx) => Boolean(ctx.boxes.support) && Boolean(ctx.boxes.detail),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const hero = heroAt(frame, boxes.hero!, mirror ? 0.72 : 0.28);
      const support = heroAt(frame, boxes.support!, mirror ? 0.28 : 0.72);
      const spots: Spot[] = [
        { role: "hero", ...hero },
        { role: "support", ...support },
      ];
      if (boxes.detail) spots.push({ role: "detail", ...bottomAt(frame, boxes.detail, 0.5, 0.98) });
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, 0.5) });
      return spots;
    },
    order: ["decor", "support", "hero", "detail"],
  },
  {
    id: "крупный план",
    about: "один крупный предмет во весь кадр и мелкая деталь в углу",
    fits: (ctx) => !ctx.boxes.support,
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const hero = heroAt(frame, boxes.hero!, 0.5);
      const spots: Spot[] = [{ role: "hero", ...hero }];
      if (boxes.detail) spots.push({ role: "detail", ...at(hero.x + (mirror ? -0.12 : 0.12), hero.y - 0.12) });
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.22 : 0.78) });
      return spots;
    },
    order: ["decor", "hero", "detail"],
  },
  {
    id: "стопка",
    about: "мелкая деталь лежит на главном, второго крупного нет",
    fits: (ctx) => !ctx.boxes.support && Boolean(ctx.boxes.detail),
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const hero = heroAt(frame, boxes.hero!, 0.5);
      const spots: Spot[] = [
        { role: "hero", ...hero },
        { role: "detail", ...at(hero.x + (mirror ? 0.08 : -0.08), hero.y - 0.1) },
      ];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.2 : 0.8) });
      return spots;
    },
    order: ["decor", "hero", "detail"],
  },
  {
    id: "одиночка",
    about: "только главный предмет, вся выразительность в обрезе краем",
    fits: (ctx) => !ctx.boxes.support && !ctx.boxes.detail,
    build: (ctx) => {
      const { boxes, frame, mirror } = ctx;
      const hero = heroAt(frame, boxes.hero!, 0.5);
      const spots: Spot[] = [{ role: "hero", ...hero }];
      if (boxes.decor) spots.push({ role: "decor", ...decorSpot(frame, boxes.decor, mirror ? 0.24 : 0.76) });
      return spots;
    },
    order: ["decor", "hero"],
  },
];

/** Список паттернов для UI и подсказки модели. */
export const PATTERN_CATALOG = PATTERNS.map((pattern) => ({ id: pattern.id, about: pattern.about }));



/**
 * План → кандидаты раскладки: каждый подходящий паттерн в двух зеркалах.
 * Выбор делает скорер, при желании его можно сузить до одной позы.
 */
export function generateLayouts(
  plan: ScenePlan,
  boxes: Partial<Record<string, Box>>,
  kinds: Partial<Record<string, Kind>>,
  frame: Frame,
  format: FormatId,
  force?: { pattern: string; mirror: boolean },
): LayoutCandidate[] {
  const roleOf = new Map<SceneRole, string>();
  for (const node of plan.nodes) roleOf.set(node.role, node.assetId);

  const boxesByRole: RoleBoxes = {};
  for (const node of plan.nodes) boxesByRole[node.role] = boxes[node.assetId];
  if (!boxesByRole.hero) return [];


  const relation = plan.relations.find((entry) => entry.target === roleOf.get("hero"))?.type ?? null;
  const candidates: LayoutCandidate[] = [];

  for (const pattern of PATTERNS) {
    if (force && pattern.id !== force.pattern) continue;
    if (!pattern.fits({ frame, format, boxes: boxesByRole, relation, mirror: false })) continue;

    for (const mirror of [false, true]) {
      if (force && mirror !== force.mirror) continue;
      const spots = pattern.build({ frame, format, boxes: boxesByRole, relation, mirror });
      const items: Item[] = [];
      for (const role of pattern.order) {
        const spot = spots.find((entry) => entry.role === role);
        const assetId = roleOf.get(role);
        if (!spot || !assetId) continue;
        // декор всегда режется кромкой: позиция зависит от его же высоты
        const point =
          role === "decor" && boxesByRole.decor
            ? decorSpot(frame, boxesByRole.decor, spot.x)
            : { x: spot.x, y: spot.y };
        items.push({
          uid: uid(assetId),
          id: assetId,
          kind: kinds[assetId] ?? "main",
          x: point.x,
          y: point.y,
          rot: 0,
          scale: 1,
        });
      }
      // кандидат обязан содержать ВСЕ узлы плана: если паттерн потерял хоть
      // один предмет, это не вариант, а обрезанная сцена
      const required = plan.nodes;
      const present = new Set(items.map((item) => item.id));
      if (!required.every((node) => present.has(node.assetId))) continue;
      if (items.length) candidates.push({ pattern: pattern.id, mirror, items });
    }
  }

  return candidates;
}
