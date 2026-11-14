import { create } from "zustand";
import {
  compose,
  composeCandidates,
  composeFromNames,
  composeNameCandidates,
  moodScheme,
  readBrief,
  type Reason,
} from "../domain/compose";
import { askPose, type Pose } from "../domain/compose/pose";
import { palettes as basePalettes } from "../domain/library";
import type { BackgroundVariant } from "../domain/background";
import type { FormatId, Kind, Palette, Size } from "../domain/library";
import { clamp01, formatById, uid, type Item } from "../domain/scene";

const STORAGE_KEY = "illustrations:palettes";

function loadCustom(): Record<string, Palette> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Palette>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCustom(palettes: Record<string, Palette>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

// по умолчанию холст пустой: сцена появляется только после запроса
const START: { items: Item[]; reasons: Record<string, Reason> } = { items: [], reasons: {} };

/**
 * Пересборка при смене формата или размера: композиция считается под новый кадр.
 * Ручные сцены (объекты без общего масштаба) не трогаем.
 */
function recompose(
  state: { brief: string; inputMode: "theme" | "objects"; items: Item[]; pose: Pose | null },
  format: FormatId,
  size: Size,
) {
  if (!state.items.length) return null;
  if (!state.items.every((item) => typeof item.scale === "number")) return null;
  const target = formatById(format);
  return state.inputMode === "objects"
    ? composeFromNames(state.brief, target, size)
    : compose(state.brief, target, size, state.pose);
}

type Store = {
  format: FormatId;
  size: Size;
  scheme: string;
  palettes: Record<string, Palette>;
  bg: BackgroundVariant;
  inputMode: "theme" | "objects";
  brief: string;
  items: Item[];
  reasons: Record<string, Reason>;
  /** сцену правили руками: формат больше не пересобирает её из темы */
  dirty: boolean;
  /** поза, выбранная моделью: переживает смену кадра */
  pose: Pose | null;
  /** идёт подбор позы: холст блокируется, показываем спиннер */
  thinking: boolean;
  /** бриф, под который собрана текущая сцена: кнопка сборки становится шаффлом */
  lastBrief: string | null;
  /** пул вариантов сцены: по нему листается «другой вариант» */
  variants: Array<{ pattern: string; mirror: boolean; items: Item[] }>;
  variantIndex: number;
  selected: string | null;
  setFormat: (format: FormatId) => void;
  setSize: (size: Size) => void;
  setScheme: (scheme: string) => void;
  setBg: (bg: BackgroundVariant) => void;
  setInputMode: (mode: "theme" | "objects") => void;
  setBrief: (brief: string) => void;
  run: (brief?: string) => void;
  nextVariant: () => void;
  addPalette: (palette: Palette) => void;
  removePalette: (key: string) => void;
  add: (id: string, kind?: Kind, x?: number, y?: number) => void;
  select: (uid: string | null) => void;
  move: (uid: string, x: number, y: number) => void;
  rotate: (uid: string, rot: number) => void;
  remove: () => void;
  duplicate: () => void;
  reorder: (dir: 1 | -1) => void;
  toggleKind: () => void;
  replace: (newId: string) => void;
  clear: () => void;
};

const custom = loadCustom();

/** Пул вариантов сцены: сначала прошедшие проверку, потом остальные. */
function poolFor(
  text: string,
  format: ReturnType<typeof formatById>,
  size: Size,
  inputMode: "theme" | "objects",
  pose?: Pose | null,
): Array<{ pattern: string; mirror: boolean; items: Item[] }> {
  // сценарий с объектами собирает пул из названий, а не из темы
  const candidates =
    inputMode === "objects"
      ? composeNameCandidates(text, format, size)
      : composeCandidates(text, format, size, pose);
  const source = inputMode === "objects" ? candidates.filter((entry) => entry.ok) : candidates;
  const ordered = [...source].sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score);
  // листаем только по корректным вариантам; если их меньше двух — по всем
  const clean = ordered.filter((entry) => entry.ok);
  const list = clean.length >= 2 ? clean : ordered;
  const seen = new Set<string>();
  const pool: Array<{ pattern: string; mirror: boolean; items: Item[] }> = [];
  for (const entry of list) {
    const key = entry.items.map((item) => `${item.id}:${item.x.toFixed(3)}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ pattern: entry.pattern, mirror: entry.mirror, items: entry.items });
  }
  return pool;
}

export const useStore = create<Store>((set, get) => ({
  format: "square",
  size: "L",
  scheme: "a",
  palettes: { ...basePalettes, ...custom },
  bg: "flat",
  inputMode: "theme",
  brief: "",
  items: START.items,
  reasons: START.reasons,
  dirty: false,
  pose: null,
  lastBrief: null,
  thinking: false,
  variants: [],
  variantIndex: 0,
  selected: null,

  setFormat: (format) =>
    set((s) => {
      // сцену правили руками — оставляем как есть, координаты заданы в долях кадра
      if (s.dirty) return { format };
      const next = recompose(s, format, s.size);
      return next ? { format, items: next.items, reasons: next.reasons } : { format };
    }),
  setSize: (size) =>
    set((s) => {
      if (s.dirty) return { size };
      const next = recompose(s, s.format, size);
      if (next) return { size, items: next.items, reasons: next.reasons };
      return {
        size,
        items: s.items.map((item) =>
          // спрайты S нарисованы вдвое мельче, холст тоже вдвое меньше — масштаб не трогаем
          typeof item.scale === "number" ? item : { ...item, scale: 1 },
        ),
      };
    }),
  setScheme: (scheme) => set({ scheme }),
  setBg: (bg) => set({ bg }),
  setInputMode: (inputMode) => set({ inputMode }),


  setBrief: (brief) => set({ brief }),

  run: (brief) => {
    const state = get();
    const text = (brief ?? state.brief).trim();
    const format = formatById(state.format);
    const next =
      state.inputMode === "objects"
        ? composeFromNames(text, format, state.size)
        : compose(text, format, state.size);
    const scheme =
      state.inputMode === "theme" ? moodScheme(readBrief(text), text) : state.scheme;
    // пул вариантов: по нему листается «другой вариант»
    const pool = poolFor(text, format, state.size, state.inputMode);
    const items = pool[0]?.items ?? next.items;
    const waiting = state.inputMode === "theme";

    const frame = formatById(state.format);

    /**
     * Сценарий темы: сначала ждём позу от модели, показывая спиннер, и только
     * потом ставим сцену. Так кадр не прыгает через две секунды после генерации.
     */
    const askAndApply = async () => {
      const pose = await askPose(text, state.format);
      if (get().brief !== text || get().dirty) {
        set({ thinking: false });
        return;
      }
      const state2 = get();
      const posed = pose ? poolFor(text, frame, state2.size, state2.inputMode) : [];
      const index = pose
        ? posed.findIndex((entry) => entry.pattern === pose.pattern && entry.mirror === pose.mirror)
        : -1;
      const ordered = index > 0 ? [posed[index], ...posed.filter((_, i) => i !== index)] : posed;
      const finalPool = ordered.length ? ordered : pool;
      set({
        thinking: false,
        // если позы для этого состава нет, не делаем вид, что она применилась
        pose: index >= 0 ? pose : null,
        variants: finalPool,
        variantIndex: 0,
        items: finalPool[0]?.items ?? items,
        reasons: next.reasons,
        selected: null,
      });
    };

    set({
      brief: text,
      lastBrief: text,
      // тема: держим прошлый кадр под спиннером, сцену поставим после ответа
      items: waiting ? state.items : items,
      reasons: waiting ? state.reasons : next.reasons,
      scheme,
      dirty: false,
      pose: null,
      thinking: waiting,
      variants: waiting ? [] : pool,
      variantIndex: 0,
      selected: null,
    });

    if (waiting) void askAndApply();
  },

  /** Следующий вариант из пула: те же предметы, другая поза. */
  nextVariant: () =>
    set((s) => {
      if (s.variants.length < 2) return s;
      const variantIndex = (s.variantIndex + 1) % s.variants.length;
      return { variantIndex, items: s.variants[variantIndex].items, selected: null };
    }),

  addPalette: (palette) => {
    const state = get();
    const isCustom = (key: string) => /^x\d+$/.test(key);
    const index = Object.keys(state.palettes).filter(isCustom).length + 1;
    const key = `x${index}`;
    const palettes = { ...state.palettes, [key]: palette };
    saveCustom(Object.fromEntries(Object.entries(palettes).filter(([k]) => isCustom(k))));
    set({ palettes, scheme: key });
  },

  removePalette: (key) => {
    const state = get();
    const palettes = { ...state.palettes };
    delete palettes[key];
    saveCustom(Object.fromEntries(Object.entries(palettes).filter(([k]) => /^x\d+$/.test(k))));
    set({ palettes, scheme: state.scheme === key ? "a" : state.scheme });
  },

  add: (id, kind = "main", x = 0.5, y = 0.5) =>
    set((s) => {
      // объект из библиотеки ставится в исходном размере ассета, как и в сцене
      const item: Item = { uid: uid(id), id, kind, x: clamp01(x), y: clamp01(y), rot: 0, scale: 1 };
      return { items: [...s.items, item], selected: item.uid, dirty: true };
    }),

  select: (selected) => set({ selected }),

  move: (id, x, y) =>
    set((s) => ({
      dirty: true,
      items: s.items.map((item) =>
        // центр пускаем за кадр: объект среды обязан выходить за край
        item.uid === id ? { ...item, x: Math.min(1.5, Math.max(-0.5, x)), y: Math.min(1.5, Math.max(-0.5, y)) } : item,
      ),
    })),

  rotate: (id, rot) =>
    set((s) => ({ dirty: true, items: s.items.map((item) => (item.uid === id ? { ...item, rot } : item)) })),

  remove: () =>
    set((s) => ({
      dirty: true,
      items: s.items.filter((item) => item.uid !== s.selected),
      selected: null,
    })),

  duplicate: () =>
    set((s) => {
      const source = s.items.find((item) => item.uid === s.selected);
      if (!source) return s;
      const copy: Item = { ...source, uid: uid(source.id), x: clamp01(source.x + 0.05), y: clamp01(source.y + 0.05) };
      const index = s.items.indexOf(source);
      const items = [...s.items];
      items.splice(index + 1, 0, copy);
      return { items, selected: copy.uid, dirty: true };
    }),

  reorder: (dir) =>
    set((s) => {
      const index = s.items.findIndex((item) => item.uid === s.selected);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= s.items.length) return s;
      const items = [...s.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { items, dirty: true };
    }),

  toggleKind: () =>
    set((s) => ({
      dirty: true,
      items: s.items.map((item) =>
        item.uid === s.selected ? { ...item, kind: item.kind === "main" ? "bg" : "main" } : item,
      ),
    })),

  replace: (newId) =>
    set((s) => ({
      dirty: true,
      items: s.items.map((item) => (item.uid === s.selected ? { ...item, id: newId } : item)),
    })),

  clear: () => set({ items: [], selected: null, reasons: {}, dirty: true }),
}));

// доступ из консоли, стенда и e2e-проверок
if (typeof window !== "undefined") {
  (window as unknown as { __store: typeof useStore }).__store = useStore;
  (window as unknown as { __candidates: () => unknown }).__candidates = () => {
    const state = useStore.getState();
    return composeCandidates(state.brief, formatById(state.format), state.size).map((entry) => ({
      pattern: entry.pattern,
      mirror: entry.mirror,
      facet: entry.facet,
      ok: entry.ok,
      score: Number(entry.score.toFixed(3)),
      violations: entry.violations,
      metrics: entry.metrics,
      items: entry.items,
    }));
  };
}
