import { describe, expect, it } from "vitest";
import { formats, objectById } from "../library";
import { compose, composeCandidates, filesForBrief, resolvePlans } from "./index";
import { FEATURED_METAPHORS, METAPHOR_PRESETS, metaphorPreset } from "./presets";

const ids = (items: Array<{ id: string }>) => items.map((item) => item.id).sort();

describe("готовые метафоры", () => {
  it("использует разные составы и три примера из общего каталога", () => {
    const casts = METAPHOR_PRESETS.map((preset) => [...preset.ids].sort().join("+"));
    expect(new Set(casts).size).toBe(METAPHOR_PRESETS.length);
    expect(FEATURED_METAPHORS).toHaveLength(3);
    for (const preset of FEATURED_METAPHORS) expect(METAPHOR_PRESETS).toContain(preset);
  });

  it("распознаёт регистр, ё, лишние пробелы и пунктуацию без перехвата произвольных тем", () => {
    expect(metaphorPreset("  В СВОЕМ   РИТМЕ! ")?.title).toBe("В своём ритме");
    expect(metaphorPreset("Знания под рукой для детей")).toBeUndefined();
    expect(resolvePlans("В СВОЕМ РИТМЕ!")[0].facet).toBe("ритм");
  });

  for (const preset of METAPHOR_PRESETS) {
    it(`${preset.title}: смысл и загрузка точно соответствуют составу`, () => {
      const plans = resolvePlans(preset.title);
      expect(plans).toHaveLength(1);
      expect(plans[0].idea).toBe(preset.idea);
      expect(plans[0].facet).toBe(preset.facet);
      expect(plans[0].nodes.map((node) => node.assetId).sort()).toEqual([...preset.ids].sort());
      for (const size of ["L", "S"] as const) {
        const expected = plans[0].nodes.map((node) => objectById.get(node.assetId)!.sizes[size][node.kind].file);
        expect(filesForBrief(preset.title, "theme", size).sort()).toEqual([...new Set(expected)].sort());
      }
    });

    for (const format of formats) {
      for (const size of ["L", "S"] as const) {
        it(`${preset.title} / ${format.id} / ${size}: варианты без нарушений и случайных предметов`, () => {
          const candidates = composeCandidates(preset.title, format, size);
          expect(candidates.length).toBeGreaterThanOrEqual(2);
          for (const candidate of candidates) {
            expect(candidate.pattern).toMatch(/^референс:/);
            expect(candidate.ok).toBe(true);
            expect(candidate.violations).toEqual([]);
            expect(ids(candidate.items)).toEqual([...preset.ids].sort());
          }
          expect(ids(compose(preset.title, format, size).items)).toEqual([...preset.ids].sort());
        });
      }
    }
  }
});
