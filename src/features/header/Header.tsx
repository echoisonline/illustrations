import { ArrowRight, ChevronDown, Shapes, Shuffle, Wand2 } from "lucide-react";
import { ExportDialog } from "../export/ExportDialog";
import { Suggestions, useSuggestions } from "./Suggestions";
import { useStore } from "../../state/store";
import { TipButton } from "../../ui/TipButton";

export function Header() {
  const brief = useStore((s) => s.brief);
  const setBrief = useStore((s) => s.setBrief);
  const run = useStore((s) => s.run);
  const format = useStore((s) => s.format);
  const inputMode = useStore((s) => s.inputMode);
  const setInputMode = useStore((s) => s.setInputMode);
  const thinking = useStore((s) => s.thinking);
  const items = useStore((s) => s.items);
  const lastBrief = useStore((s) => s.lastBrief);
  const lastMode = useStore((s) => s.lastMode);
  const variants = useStore((s) => s.variants.length);
  const variantIndex = useStore((s) => s.variantIndex);
  const nextVariant = useStore((s) => s.nextVariant);

  // листать варианты можно, только пока сцена собрана под этот же запрос:
  // режим входит в условие, иначе «тема» листала бы пул «объектов» с тем же текстом
  const canShuffle =
    items.length > 0 && brief.trim() === lastBrief && lastMode === inputMode && variants > 1;
  const setFormat = useStore((s) => s.setFormat);
  const suggest = useSuggestions();

  return (
    <header className="top">
      <div className="brand">illustrations</div>

      <form
        className="brief"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <div className="modeSwitch" role="group" aria-label="сценарий">
          <button
            type="button"
            data-on={inputMode === "theme"}
            aria-pressed={inputMode === "theme"}
            title="собрать по теме"
            onClick={() => setInputMode("theme")}
          >
            <Wand2 size={13} />
            <span>тема</span>
          </button>
          <button
            type="button"
            data-on={inputMode === "objects"}
            aria-pressed={inputMode === "objects"}
            title="собрать по названиям объектов"
            onClick={() => setInputMode("objects")}
          >
            <Shapes size={13} />
            <span>объекты</span>
          </button>
        </div>

        <div className="briefField" ref={suggest.box}>
          {/* видимая ручка выпадающего списка: без неё непонятно, что подсказки существуют */}
          <button
            type="button"
            className="briefToggle"
            data-open={suggest.open}
            aria-label="примеры формулировок"
            aria-expanded={suggest.open}
            title="примеры формулировок"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => suggest.setOpen((value) => !value)}
          >
            <ChevronDown size={15} />
          </button>
          <input
            id="scene-brief"
            value={brief}
            onFocus={() => suggest.setOpen(true)}
            onPointerDown={() => suggest.setOpen(true)}
            onChange={(event) => setBrief(event.target.value)}
            placeholder={inputMode === "theme" ? "музыка" : "лампа, папка, ручка"}
            aria-label={inputMode === "theme" ? "тема" : "названия объектов"}
            spellCheck={false}
          />
          <Suggestions open={suggest.open} onPick={() => suggest.setOpen(false)} />
        </div>

        {/* сборка и перелистывание — разные действия: раньше их прятала одна кнопка */}
        <div className="briefActions">
          <button className="btnPrimary" type="submit" disabled={!brief.trim() || thinking}>
            <ArrowRight size={14} />
            собрать
          </button>
          <button
            className="btn"
            type="button"
            disabled={!canShuffle}
            onClick={nextVariant}
            aria-label="другой вариант"
          >
            <Shuffle size={14} />
            другой вариант
            {canShuffle && (
              <span className="t-mono briefCount">
                {variantIndex + 1} / {variants}
              </span>
            )}
          </button>
        </div>
      </form>

      <div className="exportRow">
      {/* формат: три силуэта кадра вместо подписей — так строка не ломается */}
      <div className="formatRow" role="group" aria-label="формат">
        {([
          ["square", "квадрат", 13, 13],
          ["wide", "широкий", 17, 9],
          ["tall", "вертикальный", 9, 17],
        ] as const).map(([id, label, w, h]) => (
          <TipButton key={id} data-on={format === id} onClick={() => setFormat(id)} label={label} side="bottom">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <rect x={(22 - w) / 2} y={(22 - h) / 2} width={w} height={h} rx={2} />
            </svg>
          </TipButton>
        ))}
      </div>

        <ExportDialog />
      </div>
    </header>
  );
}
