import { objects } from "../library";
import type { Relation, ScenePlan, SceneRole } from "./graph";

/** Грань смысла: домен объекта. */
export const FACETS: Record<string, string[]> = {
  kniga: ["знание", "история"],
  telefon: ["продукт", "цифра"],
  pazl: ["решение", "сложность"],
  moneta: ["ценность", "деньги"],
  naushniki: ["ритм", "фокус"],
  lampa: ["идея", "работа"],
  koshelek: ["контроль", "деньги"],
  ruchka: ["авторство", "текст"],
  papka: ["порядок", "процесс"],
  vaza: ["забота", "эстетика"],
};

/** Синонимы для сценария 2. */
const ALIASES: Record<string, string[]> = {
  kniga: ["книга", "книгу", "книги", "блокнот", "тетрадь", "учебник"],
  telefon: ["телефон", "смартфон", "мобильник", "приложение", "трубка"],
  pazl: ["пазл", "пазлы", "паззл", "деталь", "кусочек"],
  moneta: ["монета", "монету", "монетка", "деньги", "копейка"],
  naushniki: ["наушники", "наушник", "гарнитура", "аудио"],
  lampa: ["лампа", "лампу", "свет", "светильник", "торшер"],
  koshelek: ["кошелек", "кошелёк", "бумажник", "картхолдер", "карта"],
  ruchka: ["ручка", "ручку", "перо", "карандаш", "маркер"],
  papka: ["папка", "папку", "файл", "документ", "скоросшиватель"],
  vaza: ["ваза", "вазу", "цветы", "цветок", "букет", "растение"],
};

/** Бриф → концепты. */
const CONCEPTS: Array<{ facet: string; re: RegExp }> = [
  { facet: "деньги", re: /деньг|финанс|бюджет|тариф|оплат|кэшбэк|доход|прибыл|цен[аыу]|стоимост/i },
  { facet: "ценность", re: /выгод|ценност|результат|рост|польз|эффект/i },
  { facet: "знание", re: /обучен|учит|учёб|учеб|курс|школ|студент|знани|читат|книг|образован|урок|лекц/i },
  { facet: "история", re: /истори|рассказ|сюжет|повеств|кейс|опыт/i },
  { facet: "идея", re: /иде[яйюи]|инсайт|вдохнов|озарен|креатив|свет|лампа|мысл/i },
  { facet: "работа", re: /работ|офис|задач|дедлайн|продуктивн|фокус|вниман|концентрац/i },
  { facet: "ритм", re: /музык|аудио|подкаст|звук|наушник|ритм|мелод|слушат/i },
  { facet: "порядок", re: /порядок|процесс|структур|систем|организац|план|архив|файл|папк/i },
  { facet: "решение", re: /решени|интеграц|сложн|собер|сборк|пазл|синтез/i },
  { facet: "продукт", re: /продукт|сервис|приложен|платформ|цифров|онлайн|сайт|запуск/i },
  { facet: "цифра", re: /цифр|данн|технолог|ит[еа]|код|разработ|инновац/i },
  { facet: "авторство", re: /текст|стат[ьи]|контент|автор|пис|редакт|бриф|документ/i },
  { facet: "забота", re: /забот|уют|красот|подар|эстетик|поддержк/i },
  { facet: "эстетика", re: /эстетик|красот|стил|дизайн|вкус|форм/i },
  { facet: "контроль", re: /контрол|сбережен|учет|учёт|аналитик|отчет|отчёт/i },
];

/** Осмысленные пары: объекты, которые читаются вместе. */
const PAIRS: Array<{ facet: string; ids: [string, string] }> = [
  { facet: "знание", ids: ["kniga", "telefon"] },
  { facet: "знание", ids: ["kniga", "lampa"] },
  { facet: "деньги", ids: ["koshelek", "moneta"] },
  { facet: "деньги", ids: ["moneta", "telefon"] },
  { facet: "идея", ids: ["lampa", "papka"] },
  { facet: "ритм", ids: ["naushniki", "telefon"] },
  { facet: "порядок", ids: ["papka", "ruchka"] },
  { facet: "продукт", ids: ["telefon", "pazl"] },
  { facet: "забота", ids: ["vaza", "kniga"] },
  { facet: "решение", ids: ["pazl", "papka"] },
  { facet: "авторство", ids: ["ruchka", "kniga"] },
  { facet: "работа", ids: ["lampa", "papka"] },
  { facet: "цифра", ids: ["telefon", "pazl"] },
  { facet: "эстетика", ids: ["vaza", "lampa"] },
  { facet: "история", ids: ["kniga", "ruchka"] },
];

/**
 * Отношение в паре — как предметы взаимодействуют в референсах.
 * Здесь же решается, разрешён ли нахлёст: «на» и «в» его подразумевают.
 */
export const PAIR_RELATION: Record<string, Relation> = {
  "kniga+telefon": "on",
  "kniga+lampa": "behind",
  "koshelek+moneta": "near",
  "moneta+telefon": "near",
  "lampa+papka": "behind",
  "naushniki+telefon": "near",
  "papka+ruchka": "on",
  "telefon+pazl": "on",
  "vaza+kniga": "near",
  "pazl+papka": "on",
  "ruchka+kniga": "on",
  "vaza+ruchka": "behind",
};

/**
 * На что вообще можно положить предмет. Наушники, лампа, ваза и пазл —
 * не плоскости: телефон «на наушниках» читается как ошибка.
 */
const SURFACES = ["kniga", "papka", "koshelek", "telefon"];

/** Мелкая деталь: кладётся поверх крупного — пазл, монета, ручка. */
const ACCENTS = ["pazl", "moneta", "ruchka"];

/** Лампа и ваза — декор: уходят вверх и работают фоном, видно примерно половину. */
export const DECOR = ["lampa", "vaza"];

/** Декор уместен не в каждой теме: лампа в сцене про деньги — лишний предмет. */
const DECOR_FACETS = ["идея", "работа", "забота", "эстетика"];

/**
 * Темы про дом и красоту: здесь ваза — не фон, а сам предмет.
 * Иначе «уют» превращался в книгу с пазлом, а ваза уходила в декор.
 */
const HOME_FACETS = new Set(["забота", "эстетика"]);

/**
 * Кто читается главным при обрезе краем: плоские «самодостаточные» предметы.
 * Ручка, лампа и монета в роли героя режутся так, что перестают узнаваться.
 */
const HERO_ORDER = ["kniga", "papka", "telefon", "koshelek", "naushniki", "pazl", "vaza", "lampa", "ruchka", "moneta"];
const heroRank = (id: string) => {
  const index = HERO_ORDER.indexOf(id);
  return index < 0 ? HERO_ORDER.length : index;
};

export type Reason = { facet: string; source: "бриф" | "роль" };

export function readBrief(brief: string): Map<string, number> {
  const weights = new Map<string, number>();
  for (const { facet, re } of CONCEPTS) {
    const hits = brief.match(new RegExp(re.source, "gi"));
    if (hits) weights.set(facet, (weights.get(facet) ?? 0) + hits.length);
  }
  return weights;
}

export function moodScheme(weights: Map<string, number>, brief: string): "a" | "b" | "c" {
  if (/распродаж|скидк|тепл|осен|еда|дом|подар/i.test(brief)) return "b";
  if (weights.has("деньги") || weights.has("ценность") || weights.has("контроль")) return "b";
  if (weights.has("цифра") || weights.has("продукт") || weights.has("эстетика")) return "c";
  return "a";
}

export function alternatives(id: string): string[] {
  const facets = FACETS[id] ?? [];
  return objects
    .filter((object) => object.id !== id && FACETS[object.id]?.some((facet) => facets.includes(facet)))
    .map((object) => object.id);
}

export const facetsOf = (id: string) => FACETS[id] ?? [];

const DISTANCE = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
};

export function parseNames(input: string): { ids: string[]; unknown: string[] } {
  const tokens = input
    .toLowerCase()
    .split(/[,;+/\n]|\s+и\s+|\s+/)
    .map((token) => token.replace(/[^а-яёa-z]/g, ""))
    .filter((token) => token.length > 2);

  const ids: string[] = [];
  const unknown: string[] = [];

  for (const token of tokens) {
    let best: { id: string; score: number } | null = null;
    for (const [id, list] of Object.entries(ALIASES)) {
      for (const alias of list) {
        const stem = alias.slice(0, Math.max(3, alias.length - 2));
        const hit = token.startsWith(stem) || stem.startsWith(token);
        const distance = DISTANCE(token, alias);
        const score = hit ? 0 : distance <= (alias.length > 5 ? 2 : 1) ? distance : Infinity;
        if (score < Infinity && (!best || score < best.score)) best = { id, score };
      }
    }
    if (best && !ids.includes(best.id)) ids.push(best.id);
    else if (!best) unknown.push(token);
  }

  return { ids, unknown };
}

function pickDecor(facet: string | null, used: string[]): string | null {
  if (!facet || !DECOR_FACETS.includes(facet)) return null;
  const free = DECOR.filter((id) => !used.includes(id));
  if (!free.length) return null;
  const wanted = facet === "забота" || facet === "эстетика" ? "vaza" : "lampa";
  return free.includes(wanted) ? wanted : free[0];
}

/** Собирает узлы и связи плана из пары и ролей. */
function planFrom(heroId: string, supportId: string | null, detailId: string | null, decorId: string | null, facet: string, idea: string): ScenePlan {
  const nodes: ScenePlan["nodes"] = [{ assetId: heroId, role: "hero", kind: "main" }];
  const relations: ScenePlan["relations"] = [];

  if (supportId) {
    let relation = PAIR_RELATION[`${heroId}+${supportId}`] ?? PAIR_RELATION[`${supportId}+${heroId}`] ?? "near";
    // «на» требует плоскости под низом: ручку на папку положить можно,
    // а телефон на наушники — нет, наушники не плоскость
    if (relation === "on" && !SURFACES.includes(heroId)) relation = "near";
    nodes.push({ assetId: supportId, role: "support", kind: "main" });
    relations.push({ source: supportId, target: heroId, type: relation });
  }
  if (detailId) {
    nodes.push({ assetId: detailId, role: "detail", kind: "main" });
    relations.push({ source: detailId, target: heroId, type: "on" });
  }
  if (decorId) {
    nodes.push({ assetId: decorId, role: "decor", kind: "bg" });
    relations.push({ source: decorId, target: heroId, type: "behind" });
  }

  return { nodes, relations, facet, idea };
}

/**
 * Тема → несколько планов сцены. Берём не одну победившую грань, а топ-3:
 * «рабочее место для идей» — это и идея, и работа, и порядок.
 */
export function resolvePlans(brief: string): ScenePlan[] {
  const weights = readBrief(brief);
  const facets = [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([facet]) => facet);
  const plans: ScenePlan[] = [];

  for (const facet of facets.slice(0, 3)) {
    const pair = PAIRS.find((entry) => entry.facet === facet);
    if (!pair) continue;

    let [heroId, supportId] = pair.ids;

    // в темах про дом и красоту герой — ваза: это и есть предмет истории
    const home = HOME_FACETS.has(facet) && pair.ids.includes("vaza");
    if (home) {
      heroId = "vaza";
      supportId = pair.ids.find((id) => id !== "vaza") ?? "";
    } else if (heroRank(heroId) > heroRank(supportId)) {
      [heroId, supportId] = [supportId, heroId];
    }

    // лампа и ваза не бывают героем: это декор, он уходит в фон
    let decorId: string | null = null;
    if (DECOR.includes(supportId) && !home) {
      decorId = supportId;
      supportId = "";
    }
    if (!decorId && !home) decorId = pickDecor(facet, [heroId, supportId].filter(Boolean));

    // если героем остался «нечитаемый» предмет (ручка, монета, пазл), берём
    // крупный из библиотеки: обрез краем такой герой не переживает
    if (!home && heroRank(heroId) > 4) {
      const readable = HERO_ORDER.slice(0, 4).find(
        (id) => id !== heroId && id !== supportId && id !== decorId,
      );
      if (readable) heroId = readable;
    }

    // деталь ставим только к обычному герою: пазл на вазе читается как мусор
    const detailId = home
      ? null
      : ACCENTS.find((id) => id !== heroId && id !== supportId && id !== decorId) ?? null;
    plans.push(
      planFrom(heroId, supportId || null, detailId, decorId, facet, `${heroId} и ${supportId || "окружение"}`),
    );
  }

  return plans;
}

/**
 * Сценарий 2: состав задан названиями. Названные предметы — закон: лампа и
 * ваза всё равно уходят в фон, остальные разбираются по ролям по порядку.
 */
export function planFromNames(ids: string[]): ScenePlan | null {
  if (!ids.length) return null;
  const decorId = ids.find((id) => DECOR.includes(id)) ?? null;
  const rest = ids.filter((id) => id !== decorId);
  const heroId = rest[0] ?? "kniga";
  const supportId = rest[1] ?? null;
  const detailId = rest[2] ?? null;
  return planFrom(heroId, supportId, detailId, decorId, "вручную", "сцена из названий");
}

export type { SceneRole };
