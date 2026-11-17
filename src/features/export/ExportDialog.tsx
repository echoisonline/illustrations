import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Download, Image as ImageIcon, X } from "lucide-react";
import { formatById, frameFor } from "../../domain/scene";
import { useStore } from "../../state/store";
import { exportPng, exportSvg } from "../export";

type Kind = "svg" | "png";

const VARIANTS: Array<{ id: Kind; label: string; hint: string; icon: typeof Download }> = [
  { id: "svg", label: "SVG", hint: "вектор, открывается в Figma", icon: Download },
  { id: "png", label: "PNG", hint: "растр в масштабе кадра", icon: ImageIcon },
];

/** Экспорт: один вход и выбор формата файла внутри. */
export function ExportDialog({ variant = "header" }: { variant?: "header" | "bottom" }) {
  const format = useStore((s) => s.format);
  const size = useStore((s) => s.size);
  const scheme = useStore((s) => s.scheme);
  const items = useStore((s) => s.items);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = frameFor(formatById(format), size);
  const tag = `${scheme}${size}`;
  const empty = items.length === 0;

  const run = async (variant: Kind) => {
    setBusy(variant);
    setError(null);
    try {
      if (variant === "svg") exportSvg(current, tag);
      else await exportPng(current, tag);
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "не удалось экспортировать");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {variant === "bottom" ? (
          <button className="bottomItem" aria-label="экспорт">
            <Download size={17} />
            экспорт
          </button>
        ) : (
          <button className="btn" aria-label="экспорт" title="экспорт">
            <Download size={14} />
            экспорт
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
        <Dialog.Content className="dialogPanel exportPanel" aria-describedby={undefined}>
          <div className="dialogHead">
            <Dialog.Title className="t-label">экспорт</Dialog.Title>
            <Dialog.Close asChild>
              <button className="iconBtn" aria-label="закрыть" title="закрыть">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <div className="exportList">
            {VARIANTS.map((variant) => {
              const Icon = variant.icon;
              return (
                <button
                  key={variant.id}
                  className="exportItem"
                  onClick={() => run(variant.id)}
                  disabled={empty || busy !== null}
                >
                  <Icon size={16} />
                  <span className="exportLabel">{variant.label}</span>
                  <span className="exportHint">{variant.hint}</span>
                  {busy === variant.id && <Check size={14} />}
                </button>
              );
            })}
          </div>

          {error && <p className="dialogMeta" role="alert">{error}</p>}
          <p className="dialogMeta t-mono">
            {empty ? "сцена пустая" : `${current.w}×${current.h}, ${items.length} слоя`}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
