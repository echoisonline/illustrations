import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** ⌘ вместо Ctrl на маке: подсказка должна совпадать с тем, что человек нажимает */
export const keyLabel = (keys: string) => (isMac ? keys.replace("Ctrl", "⌘") : keys);

/** сколько держать курсор, прежде чем показать подсказку */
const HOVER_DELAY = 280;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** текст подсказки: он же доступное имя кнопки */
  label: string;
  /** сочетание клавиш, если действие им продублировано */
  keys?: string;
  /** снизу — для кнопок у верхней кромки, где сверху места нет */
  side?: "top" | "bottom";
  /** состояние выбрано: подсказка не должна его ломать */
  "data-on"?: boolean;
  children: ReactNode;
};

/** для скринридера сочетание пишется по спецификации: «Control+D», а не «Ctrl D» */
const ariaKeys = (keys: string) =>
  keys
    .replace(/\bCtrl\b/g, "Control")
    .split(/\s+/)
    .join("+");

/**
 * Кнопка с подсказкой. Нативный title не умеет показывать клавиши и ждёт
 * секунду, поэтому подсказка своя — но закрывается на уход, скролл и Esc,
 * чтобы не висела поверх интерфейса.
 */
export function TipButton({ label, keys, side = "top", children, ...rest }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const hide = () => {
    clear();
    setOpen(false);
  };

  const show = (delay: number) => {
    clear();
    timer.current = window.setTimeout(() => {
      const node = button.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      setPos({
        left: box.left + box.width / 2,
        top: side === "top" ? box.top - 8 : box.bottom + 8,
      });
      setOpen(true);
    }, delay);
  };

  // у края экрана подсказку сдвигаем внутрь: иначе она обрезается
  useLayoutEffect(() => {
    const node = tip.current;
    if (!open || !node || !pos) return;
    const half = node.offsetWidth / 2;
    const margin = 8;
    const left = Math.min(
      Math.max(pos.left, half + margin),
      Math.max(half + margin, window.innerWidth - half - margin),
    );
    if (Math.abs(left - pos.left) > 0.5) setPos({ left, top: pos.top });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // координаты привязаны к экрану: при прокрутке подсказка устаревает
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => clear, []);

  return (
    <>
      <button
        {...rest}
        ref={button}
        aria-label={label}
        aria-keyshortcuts={keys ? ariaKeys(keys) : undefined}
        onPointerEnter={(event) => {
          rest.onPointerEnter?.(event);
          // на тач-экране наведения нет: подсказку там не показываем
          if (event.pointerType !== "touch") show(HOVER_DELAY);
        }}
        onPointerLeave={(event) => {
          rest.onPointerLeave?.(event);
          hide();
        }}
        onPointerDown={(event) => {
          rest.onPointerDown?.(event);
          hide();
        }}
        onFocus={(event) => {
          rest.onFocus?.(event);
          // с клавиатуры подсказка нужна сразу, после клика мышью — нет
          if (button.current?.matches(":focus-visible")) show(0);
        }}
        onBlur={(event) => {
          rest.onBlur?.(event);
          hide();
        }}
      >
        {children}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={tip}
            className="tip"
            data-side={side}
            style={{ left: pos.left, top: pos.top }}
            role="presentation"
          >
            <span>{label}</span>
            {keys ? <kbd className="tipKey">{keyLabel(keys)}</kbd> : null}
          </div>,
          document.body,
        )}
    </>
  );
}
