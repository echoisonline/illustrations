import type { Kind } from "../library";
import type { Item } from "../scene";

/** Смысловая роль предмета — не зависит от того, цветной он или монохромный. */
export type SceneRole = "hero" | "support" | "decor" | "detail";

/**
 * Отношение между предметами. Нахлёст разрешён только там, где его
 * подразумевает отношение: «на» и «в», «за» — частичное перекрытие фоном.
 */
export type Relation = "near" | "on" | "behind" | "above" | "below" | "overlap" | "inside";

export type SceneNode = { assetId: string; role: SceneRole; kind: Kind };
export type SceneRelation = { source: string; target: string; type: Relation };

export type ScenePlan = {
  nodes: SceneNode[];
  relations: SceneRelation[];
  /** грань темы, из которой собран план */
  facet: string;
  idea: string;
};

export type Box = { w: number; h: number };
export type Placed = Item & { role: SceneRole };
