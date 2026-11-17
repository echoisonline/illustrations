import { describe, expect, it } from "vitest";
import { objects, palettes, putSprites, sprite, type Palette } from "./index";

const object = objects[0];
const file = object.sizes.L.main.file;
const source = '<svg><path fill="#f9ecb0" d="M0 0h10v10z"/></svg>';
const color = (n: number): Palette => ({ ...palettes.a, obj: [`#${n.toString(16).padStart(6, "0")}`, ...palettes.a.obj.slice(1)] as Palette["obj"] });

describe("sprite cache", () => {
  it("shares entries across palette names and scheme identifiers", () => {
    putSprites({ [file]: source });
    const first = sprite(object.id, "main", "L", "a", palettes.a);
    expect(sprite(object.id, "main", "L", "renamed", { ...palettes.a, name: "другое имя" })).toBe(first);
  });

  it("does not retain draft previews or evict cached scene sprites", () => {
    putSprites({ [file]: source });
    const first = sprite(object.id, "main", "L", "a", palettes.a);
    const draft = sprite(object.id, "main", "L", undefined, color(1));
    expect(sprite(object.id, "main", "L", undefined, color(1))).not.toBe(draft);
    for (let i = 1; i <= 300; i++) sprite(object.id, "main", "L", undefined, color(i));
    expect(sprite(object.id, "main", "L", "a", palettes.a)).toBe(first);
    expect(sprite(object.id, "main", "L", undefined, color(1)).markup).toContain("#000001");
  });

  it("evicts old entries while refreshing recently used ones", () => {
    putSprites({ [file]: source });
    const old = sprite(object.id, "main", "L", "custom", color(1000));
    const recent = sprite(object.id, "main", "L", "custom", color(1001));
    for (let i = 1002; i < 1128; i++) sprite(object.id, "main", "L", "custom", color(i));
    expect(sprite(object.id, "main", "L", "custom", color(1001))).toBe(recent);
    sprite(object.id, "main", "L", "custom", color(1128));
    expect(sprite(object.id, "main", "L", "custom", color(1000))).not.toBe(old);
    expect(sprite(object.id, "main", "L", "custom", color(1001))).toBe(recent);
  });
});
