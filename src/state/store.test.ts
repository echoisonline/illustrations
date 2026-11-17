import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as library from "../domain/library";
import { composeFromNames } from "../domain/compose";
import { askPose } from "../domain/compose/pose";
import { formatById } from "../domain/scene";
import { useStore } from "./store";

vi.mock("../domain/compose/pose", () => ({ askPose: vi.fn().mockResolvedValue(null) }));

const geometry = (items: ReturnType<typeof useStore.getState>["items"]) =>
  items.map(({ uid: _uid, ...item }) => item);

beforeEach(() => {
  useStore.getState().clear();
  useStore.setState(useStore.getInitialState(), true);
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("пересборка кадра", () => {
  it("смена формата обновляет и сцену, и пул вариантов", () => {
    useStore.getState().setInputMode("objects");
    useStore.getState().run("книга, телефон");
    for (const format of ["wide", "tall", "square"] as const) {
      useStore.getState().setFormat(format);
      const state = useStore.getState();
      expect(state.format).toBe(format);
      expect(state.variantIndex).toBe(0);
      expect(geometry(state.items)).toEqual(geometry(composeFromNames("книга, телефон", formatById(format), "L").items));
      expect(state.items).toEqual(state.variants[0].items);
      state.nextVariant();
      expect(useStore.getState().items).toEqual(useStore.getState().variants[1].items);
    }
  });

  it("смена размера заново подбирает SVG и варианты", () => {
    useStore.getState().setInputMode("objects");
    useStore.getState().run("книга, пазл, ручка");
    useStore.getState().setSize("S");
    const state = useStore.getState();
    expect(state.size).toBe("S");
    expect(state.thinking).toBe(false);
    expect(geometry(state.items)).toEqual(geometry(composeFromNames("книга, пазл, ручка", formatById("square"), "S").items));
    expect(state.items).toEqual(state.variants[0].items);
  });

  it("не использует ещё не отправленный текст и переключённый режим ввода", () => {
    useStore.getState().setInputMode("objects");
    useStore.getState().run("телефон, пазл");
    useStore.getState().setBrief("лампа, папка, ручка");
    useStore.getState().setInputMode("theme");
    useStore.getState().setFormat("tall");
    expect(useStore.getState().items.map((item) => item.id)).toEqual(["telefon", "pazl"]);
  });

  it("после ручной правки оставляет координаты и состав нетронутыми", () => {
    useStore.getState().setInputMode("objects");
    useStore.getState().run("телефон, пазл");
    const first = useStore.getState().items[0];
    useStore.getState().move(first.uid, 0.27, 0.67);
    const manual = useStore.getState().items;
    useStore.getState().setFormat("wide");
    useStore.getState().setSize("S");
    expect(useStore.getState().items).toEqual(manual);
    expect(useStore.getState().dirty).toBe(true);
  });
});

describe("генерация и варианты", () => {
  it("референсные темы собираются сразу, без запроса произвольной позы к модели", () => {
    useStore.getState().run("обучение и курсы");
    expect(useStore.getState().thinking).toBe(false);
    expect(useStore.getState().items.map((item) => item.id)).toEqual(["kniga", "telefon"]);
    expect(askPose).not.toHaveBeenCalled();
    expect(useStore.getState().bg).toBe("geometry");
  });

  it("варианты не подменяют состав сценой из другой темы", () => {
    useStore.getState().run("обучение, деньги и музыка");
    const original = useStore.getState().items.map((item) => item.id).sort();
    for (const variant of useStore.getState().variants) {
      expect(variant.items.map((item) => item.id).sort()).toEqual(original);
    }
  });

  it("очистка не позволяет вернуть старую сцену кнопкой вариантов", () => {
    useStore.getState().run("обучение и курсы");
    useStore.getState().clear();
    useStore.getState().nextVariant();
    expect(useStore.getState().items).toEqual([]);
    expect(useStore.getState().variants).toEqual([]);
    expect(useStore.getState().thinking).toBe(false);
  });

  it("ошибка загрузки SVG не вызывает бесконечную пересборку", async () => {
    vi.spyOn(library, "hasSprite").mockReturnValue(false);
    const load = vi.spyOn(library, "ensureSprites").mockResolvedValue(undefined);
    useStore.getState().run("обучение и курсы");
    expect(useStore.getState().thinking).toBe(true);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(useStore.getState().thinking).toBe(false);
  });

  it("завершение старой загрузки не воскрешает очищенную сцену", async () => {
    vi.spyOn(library, "hasSprite").mockReturnValue(false);
    let finish!: () => void;
    vi.spyOn(library, "ensureSprites").mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    useStore.getState().run("обучение и курсы");
    useStore.getState().clear();
    finish();
    await Promise.resolve();
    expect(useStore.getState().items).toEqual([]);
    expect(useStore.getState().thinking).toBe(false);
  });
});
