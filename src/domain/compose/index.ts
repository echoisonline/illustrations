import { palettes, sprite, type Format, type Kind, type Size } from "../library";
import { contentBox } from "../library/measure";
import { frameFor, type Item } from "../scene";
import type { Box, ScenePlan, SceneRole } from "./graph";
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
  keepAll = false,
): Candidate[] {
  const plans = resolvePlans(brief);
  return candidatesFromPlans(plans, format, size, pose, true, keepAll);
}

/** Выбранная поза: паттерн и зеркало. */
export type Pose = { pattern: string; mirror: boolean };

/**
 * Проверка складываемости пары. Если два крупных предмета не помещаются рядом,
 * в сценарии с метафорой партнёра можно заменить на предмет помельче — иначе
 * остаются только позы с обрезом краем.
 */
function fitCast(plan: ScenePlan, frame: { w: number; h: number }, size: Size): ScenePlan {
  const hero = plan.nodes.find((node) => node.role === "hero");
  const support = plan.nodes.find((node) => node.role === "support");
  if (!hero || !support) return plan;

  const heroWidth = artRef(hero.assetId, "main", size).w;
  const supportWidth = artRef(support.assetId, "main", size).w;
  if (heroWidth + supportWidth <= frame.w * 1.05) return plan;

  const replacement = alternatives(hero.assetId).find((id) => {
    if (plan.nodes.some((node) => node.assetId === id)) return false;
    return heroWidth + artRef(id, "main", size).w <= frame.w * 1.0;
  });
  if (!replacement) return plan;

  return {
    ...plan,
    nodes: plan.nodes.map((node) =>
      node.assetId === support.assetId ? { ...node, assetId: replacement } : node,
    ),
    relations: plan.relations.map((entry) =>
      entry.source === support.assetId ? { ...entry, source: replacement } : entry,
    ),
  };
}

function candidatesFromPlans(
  plans: ScenePlan[],
  format: Format,
  size: Size,
  pose?: Pose | null,
  substitutable = true,
  /** в сценарии с объектами ничего не выбрасываем: предметы назвал человек */
  keepAll = false,
): Candidate[] {
  const frame = frameFor(format, size);
  const out: Candidate[] = [];

  for (const source of plans) {
    const cast = substitutable ? fitCast(source, frame, size) : source;
    const boxes: Record<string, Box> = {};
    const kinds: Record<string, Kind> = {};
    for (const node of cast.nodes) {
      boxes[node.assetId] = artRef(node.assetId, node.kind, size);
      kinds[node.assetId] = node.kind;
    }

    // В кадре не больше трёх объектов: лишний всегда деталь. И деталь не
    // ставится рядом с мелкой поддержкой — иначе на одном месте башня.
    const heroNode = cast.nodes.find((node) => node.role === "hero");
    const supportNode = cast.nodes.find((node) => node.role === "support");
    const crowded = cast.nodes.length > 3;
    const smallSupport =
      Boolean(heroNode && supportNode) &&
      Boolean(boxes[supportNode!.assetId]) &&
      boxes[supportNode!.assetId].w < (boxes[heroNode!.assetId]?.w ?? 0) * 0.6;
    const dropDetail = keepAll ? false : crowded || smallSupport;
    // если герой занял кадр целиком, декор в тему не ставим: он ляжет на него
    const dropDecor =
      !keepAll && Boolean(heroNode) && (boxes[heroNode!.assetId]?.w ?? 0) > frame.w * 1.05;
    const plan: ScenePlan = {
      ...cast,
      nodes: cast.nodes.filter(
        (node) => !(dropDetail && node.role === "detail") && !(dropDecor && node.role === "decor"),
      ),
    };

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

    const forced = pose && PATTERN_RELATION[pose.pattern] !== undefined ? pose : undefined;
    for (const candidate of generateLayouts(plan, boxes, kinds, frame, format.id, forced ?? undefined)) {
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
        score: verdict.score + match + preferred,
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
    reasons[item.uid] = {
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
  return candidatesFromPlans([plan], format, size, null, false, true);
}

/** Сценарий 2: названия → лучшая сцена из заданного набора. */
export function composeFromNames(names: string, format: Format, size: Size): Composition {
  const { ids } = parseNames(names);
  const plan = planFromNames(ids);
  if (!plan) return EMPTY;

  // названные предметы — закон: состав не подменяем и не выкидываем
  const all = candidatesFromPlans([plan], format, size, null, false, true).sort(
    (a, b) => b.score - a.score,
  );
  const best = all.find((candidate) => candidate.ok) ?? all[0];

  return best ? { items: best.items, reasons: reasonsFor(best.items, plan) } : EMPTY;
}
