import { ArrowRight, Shapes } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { backgroundFor, type BackgroundLayer } from "../../domain/background";
import { compose, filesForBrief } from "../../domain/compose";
import { hasSprite, objectById, sprite, type Format, type Palette, type Size } from "../../domain/library";
import { contentBox } from "../../domain/library/measure";
import { formatById, frameFor, type Item } from "../../domain/scene";
import { useStore } from "../../state/store";
import { useSprites } from "../../state/sprites";

/** Первый кадр: три готовые темы. Каждая миниатюра — настоящая сцена. */
const EXAMPLES = [
  { theme: "обучение и курсы", caption: "обучение" },
  { theme: "деньги и бюджет", caption: "деньги" },
  { theme: "музыка и подкасты", caption: "музыка" },
];

/** рамки размера миниатюры: мельче — не видно сцены, крупнее — карточка съедает кадр */
const THUMB_MIN = 40;
const THUMB_MAX = 240;

/**
 * Пустой холст вместо серого прямоугольника: три готовые темы, собранные тем
 * же движком, что и рабочая сцена — миниатюры не расходятся с результатом.
 */
export function StageEmpty({ sheetWidth }: { sheetWidth: number }) {
  const size = useStore((s) => s.size);
  const format = useStore((s) => s.format);
  const scheme = useStore((s) => s.scheme);
  const palettes = useStore((s) => s.palettes);
  const bg = useStore((s) => s.bg);
  const run = useStore((s) => s.run);
  const setInputMode = useStore((s) => s.setInputMode);
  const version = useSprites((s) => s.version);
  const request = useSprites((s) => s.request);

  const frame = frameFor(formatById(format), size);
  const palette = palettes[scheme] ?? palettes.a;

  // карточка растёт вместе с рабочей областью, иначе на большом экране она теряется
  const host = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 560, h: 560 });
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const measure = () => {
      const style = getComputedStyle(node);
      setArea({
        w: node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        h: node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // высота миниатюры: ограничена рамкой кадра и высотой холста.
  // 24 — зазоры между тремя, 10 — внутренний отступ самой плитки
  const ratio = frame.w / frame.h;
  const margin = sheetWidth < 520 ? 26 : 56;
  const row = Math.min(area.w, sheetWidth - margin, 820);
  const byWidth = ((row - 24) / 3 - 10) / ratio;
  const byHeight = area.h - 230;
  const thumb = Math.round(Math.max(THUMB_MIN, Math.min(THUMB_MAX, byWidth, byHeight)));

  // всё, что нужно миниатюрам: спрайты предметов и подложка текущего кадра
  const files = useMemo(() => {
    const list = EXAMPLES.flatMap((entry) => filesForBrief(entry.theme, "theme", size));
    if (bg !== "flat") list.push(`fon/${bg}-${format}.svg`, `${size}/Фон.svg`);
    return [...new Set(list)];
  }, [size, format, bg]);
  const fileKey = files.join("|");

  useEffect(() => {
    const missing = files.filter((file) => !hasSprite(file));
    if (missing.length) request(missing);
  }, [fileKey]);

  const ready = files.every((file) => hasSprite(file));

  const previews = useMemo(() => {
    // без разметки геометрия считается по рамке файла — ждём загрузку
    if (!ready) return null;
    return EXAMPLES.map((entry) => ({
      ...entry,
      items: compose(entry.theme, frame, size).items,
      plates: backgroundFor(bg, frame, size, palette),
    }));
  }, [ready, size, format, scheme, bg, version]);

  const pick = (theme: string) => {
    setInputMode("theme");
    run(theme);
  };

  const start = (mode: "theme" | "objects") => {
    setInputMode(mode);
    document.getElementById("scene-brief")?.focus();
  };

  return (
    <div className="first" ref={host}>
      <div className="firstIntro">
        <h1 className="firstTitle">Соберите иллюстрацию</h1>
        <div className="firstActions">
          <button className="firstStart" onClick={() => start("theme")}>
            Ввести тему <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button className="firstSecondary" onClick={() => start("objects")}>
            <Shapes size={16} aria-hidden="true" /> Выбрать объекты
          </button>
        </div>
      </div>
      <div className="firstRow">
        {previews
          ? previews.map((entry) => (
              <button key={entry.theme} className="firstItem" onClick={() => pick(entry.theme)}>
                <Thumb
                  items={entry.items}
                  plates={entry.plates}
                  frame={frame}
                  size={size}
                  scheme={scheme}
                  palette={palette}
                  height={thumb}
                />
                <span className="firstName">{entry.caption}</span>
              </button>
            ))
          : EXAMPLES.map((entry) => (
              <div
                key={entry.theme}
                className="firstItem"
                data-loading="true"
                aria-hidden="true"
                style={{ width: Math.round(thumb * ratio), height: thumb }}
              />
            ))}
      </div>
    </div>
  );
}

function Thumb({
  items,
  plates,
  frame,
  size,
  scheme,
  palette,
  height,
}: {
  items: Item[];
  plates: BackgroundLayer[];
  frame: Format;
  size: Size;
  scheme: string;
  palette: Palette;
  height: number;
}) {
  return (
    <svg
      className="firstArt"
      viewBox={`0 0 ${frame.w} ${frame.h}`}
      style={{ width: Math.round((height * frame.w) / frame.h), height }}
      aria-hidden="true"
    >
      <rect x={0} y={0} width={frame.w} height={frame.h} fill={palette.bg[0]} />
      {plates.map((layer, index) => (
        <g
          key={index}
          opacity={layer.opacity}
          transform={`translate(${layer.x.toFixed(2)} ${layer.y.toFixed(2)}) scale(${layer.scale.toFixed(4)})`}
          dangerouslySetInnerHTML={{ __html: layer.markup }}
        />
      ))}
      {items.map((item) => {
        const file = objectById.get(item.id)?.sizes[size][item.kind].file;
        if (!file || !hasSprite(file)) return null;
        const shape = sprite(item.id, item.kind, size, scheme, palette, item.tone);
        const box = contentBox(`first:${item.id}:${item.kind}:${size}:${scheme}`, shape.markup, shape.w, shape.h);
        const scale = item.scale ?? 1;
        const cx = (box.x + box.w / 2) * scale;
        const cy = (box.y + box.h / 2) * scale;
        // та же формула, что на холсте: миниатюра обязана совпадать со сценой
        return (
          <g
            key={item.uid}
            transform={`translate(${(item.x * frame.w).toFixed(2)} ${(item.y * frame.h).toFixed(2)}) rotate(${item.rot}) translate(${-cx.toFixed(2)} ${-cy.toFixed(2)}) scale(${scale.toFixed(4)})`}
            dangerouslySetInnerHTML={{ __html: shape.markup }}
          />
        );
      })}
    </svg>
  );
}
