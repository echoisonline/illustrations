import { describe, expect, it } from "vitest";
import { formats, objects } from "../../domain/library";
import { frameFor } from "../../domain/scene";
import {
  compose,
  composeCandidates,
  composeFromNames,
  composeNameCandidates,
  facetsOf,
  parseNames,
  planFromNames,
  readBrief,
} from "./index";

const square = formats.find((format) => format.id === "square")!;
const wide = formats.find((format) => format.id === "wide")!;
const tall = formats.find((format) => format.id === "tall")!;

const THEMES = [
  "обучение и курсы",
  "деньги и бюджет",
  "идея и вдохновение",
  "порядок в процессах",
  "музыка и подкасты",
  "уют и красота дома",
];

describe("кадры", () => {
  it("малый размер ровно вдвое меньше большого", () => {
    expect(frameFor(square, "S")).toEqual({ ...square, w: 500, h: 500 });
    expect(frameFor(wide, "S")).toEqual({ ...wide, w: 600, h: 315 });
    expect(frameFor(tall, "S")).toEqual({ ...tall, w: 400, h: 600 });
  });

  it("крупный размер не меняется", () => {
    expect(frameFor(square, "L")).toEqual(square);
  });
});

describe("разбор названий", () => {
  it("понимает список через запятую, пробел и союз", () => {
    expect(parseNames("книга, телефон, пазл").ids).toEqual(["kniga", "telefon", "pazl"]);
    expect(parseNames("кошель монета наушники").ids).toEqual(["koshelek", "moneta", "naushniki"]);
    expect(parseNames("лампа и папка").ids).toEqual(["lampa", "papka"]);
  });

  it("не выдумывает предметы из незнакомых слов", () => {
    const result = parseNames("банан");
    expect(result.ids).toEqual([]);
    expect(result.unknown).toEqual(["банан"]);
  });

  it("все предметы библиотеки находятся по своему имени", () => {
    for (const object of objects) {
      expect(parseNames(object.name).ids).toContain(object.id);
    }
  });
});

describe("план сцены", () => {
  it("лампа и ваза уходят в фон, а не в герои", () => {
    for (const decorId of ["lampa", "vaza"]) {
      const plan = planFromNames([decorId, "kniga"])!;
      expect(plan.nodes.find((node) => node.role === "decor")?.assetId).toBe(decorId);
      expect(plan.nodes.find((node) => node.role === "hero")?.assetId).toBe("kniga");
    }
  });

  it("порядок названий задаёт роли", () => {
    const plan = planFromNames(["kniga", "telefon", "pazl"])!;
    const role = (name: string) => plan.nodes.find((node) => node.role === name)?.assetId;
    expect(role("hero")).toBe("kniga");
    expect(role("support")).toBe("telefon");
    expect(role("detail")).toBe("pazl");
  });

  it("«на» ставится только на плоскость", () => {
    const plan = planFromNames(["naushniki", "telefon"])!;
    const relation = plan.relations[0];
    if (relation) expect(relation.type).not.toBe("on");
  });
});

describe("сцена по теме", () => {
  it("тема узнаётся и даёт грань", () => {
    for (const theme of THEMES) {
      expect(readBrief(theme).size, theme).toBeGreaterThan(0);
    }
  });

  it("сцена собирается во всех форматах и не пустая", () => {
    for (const theme of THEMES) {
      for (const format of [square, wide, tall]) {
        const scene = compose(theme, format, "L");
        expect(scene.items.length, `${theme} / ${format.id}`).toBeGreaterThan(1);
      }
    }
  });

  it("масштаб всегда единица, поворота по умолчанию нет", () => {
    for (const theme of THEMES) {
      for (const candidate of composeCandidates(theme, square, "L")) {
        for (const item of candidate.items) {
          expect(item.scale).toBe(1);
          expect(item.rot).toBe(0);
        }
      }
    }
  });

  it("в кадре не больше трёх предметов", () => {
    for (const theme of THEMES) {
      for (const candidate of composeCandidates(theme, square, "L")) {
        expect(candidate.items.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("сцена по названиям", () => {
  it("каждый названный предмет остаётся в каждом варианте", () => {
    const cases: Array<[string, string[]]> = [
      ["книга, телефон, пазл", ["kniga", "telefon", "pazl"]],
      ["кошель монета наушники", ["koshelek", "moneta", "naushniki"]],
      ["лампа, папка, ручка", ["lampa", "papka", "ruchka"]],
    ];

    for (const [input, ids] of cases) {
      const candidates = composeNameCandidates(input, square, "L");
      expect(candidates.length, input).toBeGreaterThan(0);
      for (const candidate of candidates) {
        const present = candidate.items.map((item) => item.id);
        for (const id of ids) expect(present, `${input} без ${id}`).toContain(id);
      }
    }
  });

  it("названия важнее темы: сцена собирается из них", () => {
    const scene = composeFromNames("лампа, папка, ручка", square, "L");
    const ids = scene.items.map((item) => item.id);
    expect(ids).toContain("papka");
    expect(ids).toContain("ruchka");
    expect(ids).toContain("lampa");
  });
});

describe("семантика", () => {
  it("у каждого предмета есть грани темы", () => {
    for (const object of objects) {
      expect(facetsOf(object.id).length).toBeGreaterThan(0);
    }
  });
});
