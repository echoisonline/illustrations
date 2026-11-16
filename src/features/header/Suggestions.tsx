import { useEffect, useRef, useState } from "react";
import { objects } from "../../domain/library";
import { useStore } from "../../state/store";

/** Готовые темы: формулировки, которые сразу собирают сцену. */
const THEMES = [
  "идея и вдохновение",
  "музыка и подкасты",
  "уют и красота дома",
  "обучение и курсы",
  "деньги и бюджет",
  "порядок в процессах",
];

const MAX_OBJECTS = 3;

/**
 * Подсказки под полем ввода. Слева темы — клик подставляет формулировку и
 * собирает сцену. Справа объекты — их выбирают по одному, текст в поле
 * собирается сам.
 */
export function Suggestions({ open, onPick }: { open: boolean; onPick: () => void }) {
  const inputMode = useStore((s) => s.inputMode);
  const brief = useStore((s) => s.brief);
  const setBrief = useStore((s) => s.setBrief);
  const setInputMode = useStore((s) => s.setInputMode);
  const run = useStore((s) => s.run);

  const [picked, setPicked] = useState<string[]>([]);

  /**
   * Закрываем панель и снимаем фокус с поля: на iPhone фокус в поле держит
   * страницу зумленной, пока человек не ткнёт куда-то ещё.
   */
  const close = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    onPick();
  };

  // открыли панель — подхватываем то, что уже написано в поле
  useEffect(() => {
    if (!open) return;
    const lower = brief.toLowerCase();
    const known = objects
      .filter((object) => lower.includes(object.name.toLowerCase()))
      .map((object) => object.id);
    setPicked(known.slice(0, MAX_OBJECTS));
  }, [open]);

  const toggle = (id: string) => {
    const next = picked.includes(id)
      ? picked.filter((entry) => entry !== id)
      : picked.length >= MAX_OBJECTS
        ? picked
        : [...picked, id];

    setPicked(next);
    setInputMode("objects");
    // поле показывает ровно то, что выбрано — как будто человек напечатал сам
    setBrief(
      next
        .map((entry) => objects.find((object) => object.id === entry)?.name.toLowerCase())
        .filter(Boolean)
        .join(", "),
    );
  };

  const build = () => {
    if (!picked.length) return;
    setInputMode("objects");
    run();
    close();
  };

  return (
    <div className="suggest" data-open={open} role="group" aria-label="готовые формулировки">
      <div className="suggestGroup">
        <div className="suggestHead">
          <span className="t-label">по теме</span>
          <span className="t-mono">метафора или задача</span>
        </div>
        <div className="suggestList">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className="suggestChip"
              data-on={inputMode === "theme" && brief === theme}
              onClick={() => {
                setInputMode("theme");
                setBrief(theme);
                run(theme);
                close();
              }}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      <div className="suggestGroup">
        <div className="suggestHead">
          <span className="t-label">по объектам</span>
          <span className="t-mono">выбери до трёх предметов</span>
        </div>
        <div className="suggestList">
          {objects.map((object) => (
            <button
              key={object.id}
              type="button"
              className="suggestChip"
              data-on={picked.includes(object.id)}
              onClick={() => toggle(object.id)}
            >
              {object.name.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="suggestFoot">
          <span className="t-mono">
            {picked.length ? `выбрано ${picked.length} из ${MAX_OBJECTS}` : "ничего не выбрано"}
          </span>
          <button type="button" className="btn" onClick={build} disabled={!picked.length}>
            собрать
          </button>
        </div>
      </div>
    </div>
  );
}

/** Открытие выпадающего списка по фокусу: закрывается по клику мимо и Esc. */
export function useSuggestions() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (box.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, box };
}
