import { describe, expect, it } from "vitest";
import { formats, objectById, objects, palettes, sprite } from "../library";
import { compose, composeFromNames, composeNameCandidates, filesForBrief, planFromNames } from "./index";

const CASES = [
  { input: "телефон, пазл", ids: ["telefon", "pazl"] },
  { input: "книга, телефон", ids: ["kniga", "telefon"] },
  { input: "папка, кошелёк, монета", ids: ["papka", "koshelek", "moneta"] },
  { input: "наушники, ваза", ids: ["naushniki", "vaza"] },
  { input: "лампа, кошелёк, монета", ids: ["lampa", "koshelek", "moneta"] },
  { input: "книга, пазл, ручка", ids: ["kniga", "pazl", "ruchka"] },
  { input: "лампа, папка, ручка", ids: ["lampa", "papka", "ruchka"] },
];

function permutations<T>(values: T[]): T[][] {
  return values.length < 2 ? [values] : values.flatMap((value, i) =>
    permutations(values.filter((_, j) => j !== i)).map((rest) => [value, ...rest]),
  );
}

const geometry = (items: ReturnType<typeof composeFromNames>["items"]) =>
  items.map(({ uid: _uid, ...item }) => item);

describe("композиции по референсам", () => {
  for (const format of formats) {
    for (const size of ["L", "S"] as const) {
      it(`${format.id} / ${size}: все варианты проходят проверку и сохраняют состав`, () => {
        for (const { input, ids } of CASES) {
          const candidates = composeNameCandidates(input, format, size);
          expect(candidates.length, input).toBeGreaterThanOrEqual(2);
          for (const candidate of candidates) {
            expect(candidate.pattern, input).toMatch(/^референс:/);
            expect(candidate.violations, `${input}: ${candidate.pattern}`).toEqual([]);
            expect(candidate.ok, input).toBe(true);
            expect(candidate.items.map((item) => item.id).sort()).toEqual([...ids].sort());
            for (const item of candidate.items) {
              expect(item.scale).toBe(1);
              expect(item.rot).toBe(0);
              expect(Number.isFinite(item.x) && Number.isFinite(item.y)).toBe(true);
            }
          }
        }
      });

      it(`${format.id} / ${size}: перестановка слов не ломает слои и кадрирование`, () => {
        for (const { input, ids } of CASES) {
          const expected = geometry(composeFromNames(input, format, size).items);
          for (const order of permutations(ids)) {
            const names = order.map((id) => objectById.get(id)!.name).join(", ");
            expect(geometry(composeFromNames(names, format, size).items), names).toEqual(expected);
            expect(composeNameCandidates(names, format, size).some((entry) => entry.ok), names).toBe(true);
          }
        }
      });
    }
  }

  it("генерация детерминирована, кроме уникальных ID слоёв", () => {
    for (const { input } of CASES) {
      expect(geometry(composeFromNames(input, formats[0], "L").items))
        .toEqual(geometry(composeFromNames(input, formats[0], "L").items));
    }
  });

  it("связи предметов сохраняются при смене формата", () => {
    for (const format of formats) {
      const scene = (input: string) => composeFromNames(input, format, "L").items;
      const phone = scene("телефон, пазл");
      expect(phone[0].id).toBe("telefon");
      expect(phone[1].y).toBeLessThan(phone[0].y);
      const book = scene("книга, телефон");
      expect(book.map((item) => item.id)).toEqual(["kniga", "telefon"]);
      const folder = scene("папка, кошелёк, монета");
      expect(folder[0].y).toBeLessThan(folder[1].y);
      const headphones = scene("наушники, ваза");
      expect(headphones[0].kind).toBe("bg");
      expect(headphones[0].y).toBeLessThan(headphones[1].y);
      const puzzle = scene("книга, пазл, ручка");
      expect(puzzle[0].id).toBe("kniga");
      expect(puzzle[0].kind).toBe("bg");
      expect(puzzle[2].id).toBe("ruchka");
      expect(puzzle[2].y).toBeGreaterThan(puzzle[1].y);
    }
  });

  it("подгружается именно тот вариант SVG, который будет в сцене", () => {
    for (const { input } of CASES) {
      for (const size of ["L", "S"] as const) {
        const files = filesForBrief(input, "objects", size);
        for (const item of composeFromNames(input, formats[0], size).items) {
          expect(files).toContain(objectById.get(item.id)!.sizes[size][item.kind].file);
        }
      }
    }
  });

  it("темы не набирают случайные дополнительные детали", () => {
    const themes = [
      ["онлайн сервис", ["telefon", "pazl"]],
      ["обучение и курсы", ["kniga", "telefon"]],
      ["порядок в процессах", ["papka", "koshelek", "moneta"]],
      ["музыка и подкасты", ["naushniki", "vaza"]],
      ["деньги и бюджет", ["koshelek", "moneta", "lampa"]],
      ["решение сложных задач", ["kniga", "pazl", "ruchka"]],
    ] as const;
    for (const format of formats) {
      for (const [theme, ids] of themes) {
        expect(compose(theme, format, "L").items.map((item) => item.id).sort(), theme)
          .toEqual([...ids].sort());
      }
    }
  });
});

describe("состав задан пользователем", () => {
  it("одинокая лампа или ваза не добавляет выдуманную книгу", () => {
    for (const id of ["lampa", "vaza"]) {
      expect(planFromNames([id])!.nodes.map((node) => node.assetId)).toEqual([id]);
    }
  });

  it("сохраняет больше четырёх предметов, не перезаписывая одинаковые роли", () => {
    const names = objects.map((object) => object.name).join(", ");
    for (const format of formats) {
      const result = composeFromNames(names, format, "L");
      expect(result.items.map((item) => item.id).sort()).toEqual(objects.map((object) => object.id).sort());
    }
  });
});

describe("цветовые роли", () => {
  it("тёплый кошелёк перекрашивается палитрой, а геометрия остаётся прежней", () => {
    const base = sprite("koshelek", "main", "L", "a", palettes.a);
    const warm = sprite("koshelek", "main", "L", "a", palettes.a, "warm");
    expect(warm.w).toBe(base.w);
    expect(warm.h).toBe(base.h);
    expect(warm.markup.replace(/#[0-9a-f]{6}/gi, "COLOR"))
      .toBe(base.markup.replace(/#[0-9a-f]{6}/gi, "COLOR"));
    expect(warm.markup.toLowerCase()).toContain(palettes.a.obj[1]);
    expect(warm.markup.toLowerCase()).not.toContain(palettes.a.bg[0]);
  });
});
