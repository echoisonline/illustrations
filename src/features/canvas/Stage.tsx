import { useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { hasSprite, objectById, sprite } from "../../domain/library";
import { useSprites } from "../../state/sprites";
import { DRAG_TYPE } from "../library/LibraryRail";
import { backgroundFor } from "../../domain/background";
import { contentBox } from "../../domain/library/measure";
import { formatById, frameFor } from "../../domain/scene";
import { useStore } from "../../state/store";

import { Spinner } from "../../ui/Spinner";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Layers,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";

type DragState = {
  uid: string;
  mode: "move" | "rotate";
  startX: number;
  startY: number;
  x: number;
  y: number;
  rot: number;
  angle: number;
};

export function Stage() {
  const items = useStore((s) => s.items);
  const thinking = useStore((s) => s.thinking);
  // любая загрузка спрайта меняет версию — холст перерисуется
  useSprites((s) => s.version);
  const requestSprites = useSprites((s) => s.request);
  const spritesLoading = useSprites((s) => s.loading > 0);
  const busy = thinking || spritesLoading;

  const format = useStore((s) => s.format);
  const size = useStore((s) => s.size);
  const scheme = useStore((s) => s.scheme);
  const palettes = useStore((s) => s.palettes);
  const selected = useStore((s) => s.selected);
  const [menu, setMenu] = useState<{ x: number; y: number; uid: string } | null>(null);


  /** долгое нажатие открывает меню на тач-экранах: правой кнопки там нет */
  const longPress = useRef<number | null>(null);
  /** второе быстрое касание того же предмета тоже открывает меню */
  const lastTap = useRef<{ uid: string; time: number } | null>(null);
  const DOUBLE_TAP = 320;

  const cancelLongPress = () => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };
  const bg = useStore((s) => s.bg);
  // что понадобится нарисовать: предметы сцены и подложка текущего кадра
  const needed = items
    .map((item) => objectById.get(item.id)?.sizes[size][item.kind].file)
    .filter((file): file is string => Boolean(file));
  const plateFiles =
    bg === "flat"
      ? []
      : [`fon/${bg}-${format}.svg`, `fon/${bg}-${format}-${size}.svg`, `${size}/Фон.svg`];
  const missing = [...needed, ...plateFiles].filter((file) => !hasSprite(file));
  useEffect(() => {
    if (missing.length) requestSprites(missing);
  }, [missing.join("|")]);
  const select = useStore((s) => s.select);
  const move = useStore((s) => s.move);
  const rotate = useStore((s) => s.rotate);
  const add = useStore((s) => s.add);

  const svgRef = useRef<SVGSVGElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [fit, setFit] = useState(1);

  const current = formatById(format);
  const frame = frameFor(current, size);
  // у каждого объекта свой ярус крупности; общий масштаб — только запасной
  const fallbackScale = 1;
  const palette = palettes[scheme] ?? palettes.a;

  // холст всегда вписываем в рабочую область: смена размера меняет пиксели
  // файла, а не масштаб на экране
  useLayoutEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    const update = () => {
      const style = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const next = Math.min(width / frame.w, height / frame.h);
      if (Number.isFinite(next) && next > 0) setFit(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [frame.w, frame.h]);

  const toScene = (event: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    // схлопнутый или скрытый холст даёт нули — иначе в координаты уйдёт NaN
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * frame.w,
      y: ((event.clientY - rect.top) / rect.height) * frame.h,
    };
  };

  /** Ручка в углу рамки: тянем — предмет поворачивается вокруг своего центра. */
  const startRotate = (event: ReactPointerEvent, uid: string) => {
    event.stopPropagation();
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    select(uid);
    const point = toScene(event);
    if (!point) return;
    drag.current = {
      uid,
      mode: "rotate",
      startX: point.x,
      startY: point.y,
      x: item.x,
      y: item.y,
      rot: item.rot,
      angle: Math.atan2(point.y - item.y * frame.h, point.x - item.x * frame.w),
    };
    // быстрый тап успевает отпустить указатель раньше захвата — это не ошибка
    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      /* указатель уже отпущен: перетаскивание всё равно начнётся по движению */
    }
  };

  const onPointerDown = (event: ReactPointerEvent, uid: string) => {
    event.stopPropagation();
    select(uid);
    setMenu(null);
    cancelLongPress();
    if (event.pointerType !== "mouse") {
      const { clientX, clientY } = event;
      const previous = lastTap.current;
      const now = performance.now();

      // двойное касание: второе подряд быстрее 320 мс по тому же предмету
      if (previous && previous.uid === uid && now - previous.time < DOUBLE_TAP) {
        lastTap.current = null;
        drag.current = null;
        setMenu({ x: clientX, y: clientY, uid });
        return;
      }

      lastTap.current = { uid, time: now };
      longPress.current = window.setTimeout(() => {
        longPress.current = null;
        lastTap.current = null;
        drag.current = null;
        setMenu({ x: clientX, y: clientY, uid });
      }, 450);
    }
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    const point = toScene(event);
    if (!point) return;
    drag.current = {
      uid,
      mode: event.shiftKey ? "rotate" : "move",
      startX: point.x,
      startY: point.y,
      x: item.x,
      y: item.y,
      rot: item.rot,
      angle: Math.atan2(point.y - item.y * frame.h, point.x - item.x * frame.w),
    };
    // быстрый тап успевает отпустить указатель раньше захвата — это не ошибка
    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      /* указатель уже отпущен: перетаскивание всё равно начнётся по движению */
    }
  };

  /**
   * Обновление сцены на кадр, а не на каждое событие указателя: мышь шлёт до
   * 120–250 событий в секунду, и React успевал перерисовывать сцену чаще, чем
   * экран. Перерисовка теперь одна на кадр.
   */
  const pending = useRef<{ x: number; y: number; shift: boolean } | null>(null);
  const raf = useRef<number | null>(null);

  const applyDrag = () => {
    raf.current = null;
    const state = drag.current;
    const point = pending.current;
    pending.current = null;
    if (!state || !point) return;
    const item = useStore.getState().items.find((i) => i.uid === state.uid);
    if (!item) return;
    if (state.mode === "move") {
      move(state.uid, state.x + (point.x - state.startX) / frame.w, state.y + (point.y - state.startY) / frame.h);
      return;
    }
    const angle = Math.atan2(point.y - item.y * frame.h, point.x - item.x * frame.w);
    const degrees = ((angle - state.angle) * 180) / Math.PI;
    // поворот свободный, шифт выравнивает по пятнадцати градусам
    const step = point.shift ? 15 : 1;
    rotate(state.uid, Math.round((state.rot + degrees) / step) * step);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state) return;
    // палец поехал — это перетаскивание, а не долгое нажатие
    cancelLongPress();
    const point = toScene(event);
    if (!point) return;
    pending.current = { x: point.x, y: point.y, shift: event.shiftKey };
    if (raf.current === null) raf.current = requestAnimationFrame(applyDrag);
  };

  const endDrag = () => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
      applyDrag();
    }
    drag.current = null;
    cancelLongPress();
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // объект тащат из библиотеки → кладём в точку броска
  const markDrop = (active: boolean) => areaRef.current?.setAttribute("data-drop", String(active));

  const onDropDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    markDrop(true);
    try {
      event.dataTransfer.dropEffect = "copy";
    } catch {
      /* некоторые браузеры не дают менять эффект — не критично */
    }
  };

  const onDropDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    markDrop(false);
  };

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    markDrop(false);
    const id = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");
    const svg = svgRef.current;
    if (!id || !objectById.has(id) || !svg) return;
    const rect = svg.getBoundingClientRect();
    add(
      id,
      "main",
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    );
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const store = useStore.getState();
      const item = store.items.find((i) => i.uid === store.selected);
      if (!item) return;
      const step = event.shiftKey ? 0.02 : 0.005;
      switch (event.key) {
        case "Delete":
        case "Backspace":
          event.preventDefault();
          store.remove();
          break;
        case "d":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            store.duplicate();
          }
          break;
        case "[":
          event.preventDefault();
          store.rotate(item.uid, item.rot - 5);
          break;
        case "]":
          event.preventDefault();
          store.rotate(item.uid, item.rot + 5);
          break;
        case "ArrowUp":
          event.preventDefault();
          store.move(item.uid, item.x, item.y - step);
          break;
        case "ArrowDown":
          event.preventDefault();
          store.move(item.uid, item.x, item.y + step);
          break;
        case "ArrowLeft":
          event.preventDefault();
          store.move(item.uid, item.x - step, item.y);
          break;
        case "ArrowRight":
          event.preventDefault();
          store.move(item.uid, item.x + step, item.y);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="stageCol">
      <div
        ref={areaRef}
        className="stageArea"
        data-drop="false"
        onDragOver={onDropDragOver}
        onDragLeave={onDropDragLeave}
        onDrop={onDrop}
      >
        <div className="mat" data-busy={busy}>
          <div className="sheetCaption t-mono">
            <span>{current.name}</span>
            <span>
              {frame.w}×{frame.h}
            </span>
          </div>
          <svg
            id="stage"
            ref={svgRef}
            className="sheet"
            width={frame.w}
            height={frame.h}
            viewBox={`0 0 ${frame.w} ${frame.h}`}
            style={{
              background: palette.bg[0],
              width: Math.floor(frame.w * fit),
              height: Math.floor(frame.h * fit),
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={() => {
              // на iPhone фокус в поле ввода держит зум — снимаем его при тапе по кадру
              (document.activeElement as HTMLElement | null)?.blur?.();
              select(null);
            }}
          >
            {/* фон — обычная фигура в файле, иначе он терялся при экспорте */}
            <rect id="фон" x={0} y={0} width={frame.w} height={frame.h} fill={palette.bg[0]} />
            {bg !== "flat" &&
              backgroundFor(bg, frame, size, palette).map((layer, index) => (
                <g
                  key={index}
                  data-bg
                  id="подложка"
                  opacity={layer.opacity}
                  transform={`translate(${layer.x.toFixed(2)} ${layer.y.toFixed(2)}) scale(${layer.scale.toFixed(4)})`}
                  dangerouslySetInnerHTML={{ __html: layer.markup }}
                />
              ))}
            {items.map((item, index) => {
              // разметка ещё не приехала — предмет не рисуем, но кадр не ломаем
              const file = objectById.get(item.id)?.sizes[size][item.kind].file;
              if (!file || !hasSprite(file)) return null;
              const shape = sprite(item.id, item.kind, size, scheme, palette);
              const box = contentBox(`${item.id}:${item.kind}:${size}:${scheme}`, shape.markup, shape.w, shape.h);
              const scale = item.scale ?? fallbackScale;
              const cx = (box.x + box.w / 2) * scale;
              const cy = (box.y + box.h / 2) * scale;
              const layerName = objectById.get(item.id)?.name ?? item.id;
              return (
                <g
                  key={item.uid}
                  id={`${layerName}-${index + 1}`}
                  data-item
                  data-selected={item.uid === selected}
                  className="item"
                  transform={`translate(${(item.x * frame.w).toFixed(2)} ${(item.y * frame.h).toFixed(2)}) rotate(${item.rot}) translate(${-cx.toFixed(2)} ${-cy.toFixed(2)}) scale(${scale.toFixed(4)})`}
                  onPointerDown={(event) => onPointerDown(event, item.uid)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    select(item.uid);
                    setMenu({ x: event.clientX, y: event.clientY, uid: item.uid });
                  }}
                >
                  <rect className="hit" data-hit x={box.x} y={box.y} width={box.w} height={box.h} />
                  <g dangerouslySetInnerHTML={{ __html: shape.markup }} />
                  {item.uid === selected && (
                    <g data-ui>
                      <rect
                        x={box.x}
                        y={box.y}
                        width={box.w}
                        height={box.h}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* углы — ручки поворота: тянешь без всяких шифтов */}
                      {[
                        [box.x, box.y],
                        [box.x + box.w, box.y],
                        [box.x + box.w, box.y + box.h],
                        [box.x, box.y + box.h],
                      ].map(([hx, hy]) => (
                        <circle
                          key={`${hx}-${hy}`}
                          className="rotHandle"
                          cx={hx}
                          cy={hy}
                          r={7}
                          onPointerDown={(event) => startRotate(event, item.uid)}
                        >
                          <title>потяните, чтобы повернуть</title>
                        </circle>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {busy && (
            <div className="busy">
              <Spinner size={28} />
            </div>
          )}
        </div>
      </div>

      {menu && (
        <div
          className="ctxMenu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => { useStore.getState().duplicate(); setMenu(null); }}>
            <Copy size={14} />
            <span>Дублировать</span>
          </button>
          <button onClick={() => { useStore.getState().reorder(1); setMenu(null); }}>
            <ArrowUp size={14} />
            <span>Выше слоем</span>
          </button>
          <button onClick={() => { useStore.getState().reorder(-1); setMenu(null); }}>
            <ArrowDown size={14} />
            <span>Ниже слоем</span>
          </button>
          <button
            onClick={() => {
              const item = useStore.getState().items.find((i) => i.uid === menu.uid);
              if (item) useStore.getState().rotate(menu.uid, item.rot + 15);
              setMenu(null);
            }}
          >
            <RotateCw size={14} />
            <span>Повернуть на 15°</span>
          </button>
          <button
            onClick={() => {
              useStore.getState().rotate(menu.uid, 0);
              setMenu(null);
            }}
          >
            <RotateCcw size={14} />
            <span>Выпрямить</span>
          </button>
          <button onClick={() => { useStore.getState().toggleKind(); setMenu(null); }}>
            <Layers size={14} />
            <span>Сменить тон</span>
          </button>
          <button onClick={() => { useStore.getState().remove(); setMenu(null); }}>
            <Trash2 size={14} />
            <span>Удалить</span>
          </button>
        </div>
      )}
    </div>
  );
}


