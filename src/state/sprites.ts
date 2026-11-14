import { create } from "zustand";
import { ensureSprites, hasSprite } from "../domain/library";

/**
 * Загрузка спрайта асинхронная, а рисование синхронное. Этот стор просит файлы
 * и держит счётчик: компонент подписывается на версию и перерисовывается,
 * когда разметка появилась.
 */
type SpritesState = {
  version: number;
  loading: number;
  request: (files: string[]) => void;
};

const inFlight = new Set<string>();

export const useSprites = create<SpritesState>((set, get) => ({
  version: 0,
  loading: 0,
  request: (files) => {
    const missing = files.filter((file) => file && !hasSprite(file) && !inFlight.has(file));
    if (!missing.length) return;

    for (const file of missing) inFlight.add(file);
    set({ loading: get().loading + 1 });

    void ensureSprites(missing).then(() => {
      for (const file of missing) inFlight.delete(file);
      set({ version: get().version + 1, loading: Math.max(0, get().loading - 1) });
    });
  },
}));
