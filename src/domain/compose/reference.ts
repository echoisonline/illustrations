import type { FormatId, Kind } from "../library";
import { uid, type Item } from "../scene";
import type { ScenePlan } from "./graph";
import type { LayoutCandidate } from "./layout";

type Point = readonly [number, number];
type Placement = { id: string; kind?: Kind; tone?: "warm"; square: Point; wide: Point; tall: Point };
type Recipe = {
  id: string;
  hero: string;
  minVisible?: number;
  overlaps?: Array<[string, string]>;
  required: string[];
  placements: Placement[];
};

const RECIPES: Recipe[] = [
  {
    id: "телефон и пазл",
    hero: "telefon",
    overlaps: [["telefon", "pazl"]],
    required: ["telefon", "pazl"],
    placements: [
      { id: "telefon", square: [0.48, 0.61], wide: [0.40, 0.61], tall: [0.31, 0.61] },
      { id: "pazl", square: [0.60, 0.31], wide: [0.74, 0.33], tall: [0.58, 0.31] },
    ],
  },
  {
    id: "книга и телефон",
    hero: "kniga",
    minVisible: 0.28,
    overlaps: [["kniga", "telefon"], ["kniga", "pazl"]],
    required: ["kniga", "telefon"],
    placements: [
      { id: "kniga", square: [0.25, 0.48], wide: [0.28, 0.57], tall: [0.20, 0.49] },
      { id: "telefon", square: [0.50, 0.44], wide: [0.87, 0.46], tall: [0.93, 0.50] },
      { id: "pazl", square: [0.12, 0.47], wide: [0.19, 0.39], tall: [0.08, 0.41] },
    ],
  },
  {
    id: "папка и кошелёк",
    hero: "papka",
    minVisible: 0.28,
    required: ["papka", "koshelek"],
    placements: [
      { id: "papka", square: [0.66, 0.30], wide: [0.72, 0.10], tall: [0.76, 0.22] },
      { id: "koshelek", square: [0.15, 0.75], wide: [0.06, 0.66], tall: [0.12, 0.63] },
      { id: "moneta", square: [0.64, 0.79], wide: [0.49, 0.81], tall: [0.74, 0.80] },
    ],
  },
  {
    id: "наушники и ваза",
    hero: "naushniki",
    required: ["naushniki"],
    placements: [
      { id: "vaza", kind: "bg", square: [0.29, 0.035], wide: [0.21, -0.04], tall: [0.75, 0.07] },
      { id: "naushniki", square: [0.68, 0.63], wide: [0.67, 0.80], tall: [0.59, 0.77] },
    ],
  },
  {
    id: "кошелёк и монета",
    hero: "koshelek",
    required: ["koshelek", "moneta"],
    placements: [
      { id: "lampa", kind: "bg", square: [0.29, -0.04], wide: [0.21, -0.22], tall: [0.23, -0.04] },
      { id: "koshelek", tone: "warm", square: [0.45, 0.76], wide: [0.51, 0.80], tall: [0.44, 0.79] },
      { id: "moneta", square: [0.76, 0.52], wide: [0.88, 0.34], tall: [0.64, 0.53] },
    ],
  },
  {
    id: "книга и пазл",
    hero: "kniga",
    minVisible: 0.18,
    overlaps: [["kniga", "pazl"]],
    required: ["kniga", "pazl"],
    placements: [
      { id: "kniga", kind: "bg", square: [0.52, 0.22], wide: [0.73, 0.28], tall: [0.52, 0.32] },
      { id: "pazl", square: [0.36, 0.27], wide: [0.60, 0.15], tall: [0.25, 0.33] },
      { id: "ruchka", square: [0.35, 0.80], wide: [0.30, 0.73], tall: [0.36, 0.82] },
    ],
  },
  {
    id: "рабочий стол",
    hero: "papka",
    minVisible: 0.28,
    overlaps: [["papka", "ruchka"]],
    required: ["papka", "ruchka"],
    placements: [
      { id: "lampa", kind: "bg", square: [0.22, -0.12], wide: [0.16, -0.30], tall: [0.22, -0.05] },
      { id: "papka", square: [0.63, 0.63], wide: [0.66, 0.66], tall: [0.63, 0.70] },
      { id: "ruchka", square: [0.58, 0.59], wide: [0.64, 0.53], tall: [0.57, 0.66] },
    ],
  },
];

function recipeFor(plan: ScenePlan): Recipe | undefined {
  const ids = new Set(plan.nodes.map((node) => node.assetId));
  return RECIPES.find((entry) =>
    entry.required.every((id) => ids.has(id)) &&
    plan.nodes.every((node) => entry.placements.some((spot) => spot.id === node.assetId)),
  );
}

export function referencePlan(plan: ScenePlan): ScenePlan {
  const recipe = recipeFor(plan);
  if (!recipe) return plan;
  return {
    ...plan,
    nodes: plan.nodes.map((node) => ({
      ...node,
      kind: recipe.placements.find((spot) => spot.id === node.assetId)?.kind ?? node.kind,
    })),
  };
}

/** Координаты относятся к центру рисунка, не к прозрачному полю SVG.
 * Вариации сдвигают всю сцену: связанные предметы не разъезжаются. */
export function referenceLayouts(plan: ScenePlan, format: FormatId): LayoutCandidate[] {
  const recipe = recipeFor(plan);
  if (!recipe) return [];

  return [0, -0.025, 0.025].map((shift, index) => ({
    pattern: `референс: ${recipe.id}${index ? ` · ${index + 1}` : ""}`,
    mirror: false,
    framing: {
      heroId: recipe.hero,
      minVisible: recipe.minVisible ?? 0.6,
      overlaps: (recipe.overlaps ?? []).map((pair) => [...pair].sort().join("+")),
    },
    items: recipe.placements.flatMap((spot): Item[] => {
      const node = plan.nodes.find((entry) => entry.assetId === spot.id);
      if (!node) return [];
      const [x, y] = spot[format];
      return [{ uid: uid(spot.id), id: spot.id, kind: spot.kind ?? node.kind, tone: spot.tone, x: x + shift, y: y + shift * 0.5, scale: 1, rot: 0 }];
    }),
  }));
}
