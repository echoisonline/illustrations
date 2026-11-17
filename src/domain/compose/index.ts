import { objectById, palettes, sprite, type Format, type Kind, type Size } from "../library";
import { contentBox } from "../library/measure";
import { frameFor, type Item } from "../scene";
import type { Box, ScenePlan, SceneRole } from "./graph";
import { referenceLayouts } from "./reference";
import { generateLayouts } from "./layout";
import { judge } from "./score";
import { alternatives, facetsOf, moodScheme, parseNames, planFromNames, readBrief, resolvePlans, type Reason } from "./semantic";

export { alternatives, facetsOf, moodScheme, parseNames, planFromNames, readBrief, resolvePlans };
export type { Reason };

/** Реальные границы рисунка внутри SVG: рамка файла шире, чем сам объект. */
function artRef(id: string, kind: Kind, size: Size): Box {
  const shape = sprite(id, kind, size, "a", palettes.a);
  const box = contentBox(`compose:${id}:${kind}:${size}`, shape.markup, shape.w, shape.h);
  return { w: box.w, h: box.h };
}

/** Габариты рисунка: нужны раскладке. */
export const artBox = (id: string, kind: Kind, size: Size) => artRef(id, kind, size);

export type Composition = { items: Item[]; reasons: Record<string, Reason> };

/** Кандидат вместе с вердиктом — этим пользуется стенд визуального тестирования. */
export type Candidate = {
  pattern: string;
  mirror: boolean;
  facet: string;
  ok: boolean;
  score: number;
  violations: string[];
  items: Item[];
  metrics?: { heroVisible: number; maxOverlap: number; occupancy: number; balance: number };
};

const EMPTY: Composition = { items: [], reasons: {} };

/** Какой паттерн выражает какое отношение: совпадение даёт бонус к оценке. */
const PATTERN_RELATION: Record<string, string> = {
  взаимодействие: "on",
  соседство: "near",
  диагональ: "behind",
  вертикаль: "above",
};

/**
 * Поза по умолчанию для темы — до того, как пришёл выбор модели.
 * Это стартовое мнение правил, а не окончательное.
 */
const PREFERRED: Record<string, string> = {
  знание: "взаимодействие",
  история: "взаимодействие",
  деньги: "соседство",
  ценность: "соседство",
  контроль: "соседство",
  идея: "угол",
  работа: "вертикаль",
  порядок: "парад",
  решение: "парад",
  продукт: "крупный план",
  цифра: "крупный план",
  ритм: "диагональ",
  авторство: "стопка",
  забота: "крупный план",
  эстетика: "одиночка",
};

/**
 * Все варианты сцены по теме: несколько планов (топ-3 грани) × паттерны ×
 * зеркало, с проверкой ограничений и оценкой. Модуль ничего не рисует.
 */
export function composeCandidates(
  brief: string,
  format: Format,
  size: Size,
  pose?: Pose | null,
): Candidate[] {
  const plans = resolvePlans(brief);
  return candidatesFromPlans(plans, format, size, pose);
}

/** Выбранная поза: паттерн и зеркало. */
export type Pose = { pattern: string; mirror: boolean };

function candidatesFromPlans(
  plans: ScenePlan[],
  format: Format,
  size: Size,
  pose?: Pose | null,
): Candidate[] {
  const frame = frameFor(format, size);
  const out: Candidate[] = [];

  for (const plan of plans) {
    const boxes: Record<string, Box> = {};
    const kinds: Record<string, Kind> = {};
    for (const node of plan.nodes) {
      boxes[node.assetId] = artRef(node.assetId, node.kind, size);
      kinds[node.assetId] = node.kind;
    }

    const roles: Record<string, SceneRole> = {};
    for (const node of plan.nodes) roles[node.assetId] = node.role;

    const hero = plan.nodes.find((node) => node.role === "hero");
    if (!hero) continue;
    // декор стоит в фоне и может быть частично закрыт — это не конфликт
    const largeIds = new Set<string>(
      plan.nodes
        .filter((node) => node.role === "hero" || node.role === "support")
        .map((node) => node.assetId),
    );
    // «на», «внутри» и «перекрытие» — осмысленный нахлёст, а не случайный
    const allowed = new Set(
      plan.relations
        .filter((entry) => entry.type === "on" || entry.type === "inside" || entry.type === "overlap")
        .map((entry) => [entry.source, entry.target].sort().join("+")),
    );

    const references = referenceLayouts(plan, format.id);
    const layouts = references.length ? references : generateLayouts(plan, boxes, kinds, frame, format.id);
    for (const candidate of layouts) {
      const verdict = judge(candidate, boxes, frame, largeIds, hero.assetId, allowed, roles);
      // «Relations»: если паттерн совпал с задуманным отношением — бонус
      const intended = plan.relations.find((entry) => entry.target === hero.assetId)?.type;
      const match = intended && PATTERN_RELATION[candidate.pattern] === intended ? 0.06 : 0;
      // поза, назначенная теме правилами или моделью, весит чуть больше
      const preferred = pose
        ? candidate.pattern === pose.pattern && candidate.mirror === pose.mirror
          ? 0.12
          : 0
        : PREFERRED[plan.facet] === candidate.pattern
          ? 0.05
          : 0;
      out.push({
        pattern: candidate.pattern,
        mirror: candidate.mirror,
        facet: plan.facet,
        ok: verdict.ok,
        score: references.length ? 2 - references.indexOf(candidate) * 0.01 : verdict.score + match + preferred,
        violations: verdict.violations,
        items: candidate.items,
        metrics: verdict.metrics,
      });
    }
  }

  return out;
}

function reasonsFor(items: Item[], plan: ScenePlan | null): Record<string, Reason> {
  const reasons: Record<string, Reason> = {};
  for (const item of items) {
    const role = plan?.nodes.find((node) => node.assetId === item.id)?.role;
    // ключ — сам предмет, а не uid прохода: сцена и причины считаются
    // разными проходами, uid у них разные
    reasons[item.id] = {
      facet: item.kind === "bg" ? "фон" : (facetsOf(item.id)[0] ?? "главный"),
      source: role === "decor" || role === "detail" ? "роль" : "бриф",
    };
  }
  return reasons;
}

/** Сценарий 1: тема → лучшая сцена. */
export function compose(brief: string, format: Format, size: Size, pose?: Pose | null): Composition {
  const plans = resolvePlans(brief);
  const all = candidatesFromPlans(plans, format, size, pose).sort((a, b) => b.score - a.score);
  // приоритет — варианты без нарушений; если таких нет, показываем лучший
  // из имеющихся, но сцену никогда не оставляем пустой
  const best = all.find((candidate) => candidate.ok) ?? all[0];
  if (!best) return EMPTY;

  const plan = plans.find((entry) => entry.facet === best.facet) ?? null;
  return { items: best.items, reasons: reasonsFor(best.items, plan) };
}

/**
 * Сценарий 2: названия → все варианты раскладки. Подмены состава нет:
 * предметы назвал человек, движок выбирает только позу.
 */
export function composeNameCandidates(
  names: string,
  format: Format,
  size: Size,
): Candidate[] {
  const { ids } = parseNames(names);
  const plan = planFromNames(ids);
  if (!plan) return [];
  return candidatesFromPlans([plan], format, size);
}

/** Сценарий 2: названия → лучшая сцена из заданного набора. */
export function composeFromNames(names: string, format: Format, size: Size): Composition {
  const { ids } = parseNames(names);
  const plan = planFromNames(ids);
  if (!plan) return EMPTY;

  // названные предметы — закон: состав не подменяем и не выкидываем
  const all = candidatesFromPlans([plan], format, size).sort(
    (a, b) => b.score - a.score,
  );
  const best = all.find((candidate) => candidate.ok) ?? all[0];

  return best ? { items: best.items, reasons: reasonsFor(best.items, plan) } : EMPTY;
}

/**
 * Какие файлы понадобятся, чтобы собрать сцену по этому брифу. Нужен до расчёта:
 * геометрия считается по реальным границам рисунка, а разметка грузится лениво.
 */
export function filesForBrief(
  brief: string,
  mode: "theme" | "objects",
  size: Size,
): string[] {
  const plans: ScenePlan[] =
    mode === "objects"
      ? [planFromNames(parseNames(brief).ids)].filter((plan): plan is ScenePlan => Boolean(plan))
      : resolvePlans(brief);

  const files = new Set<string>();
  for (const plan of plans) {
    for (const node of plan.nodes) {
      const file = objectById.get(node.assetId)?.sizes[size][node.kind].file;
      if (file) files.add(file);
    }
  }
  return [...files];
}