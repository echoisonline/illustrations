import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Braces, Check, ClipboardPaste, Plus, X } from "lucide-react";
import { sprite, type Palette } from "../../domain/library";
import { contrast, parsePalette, paletteSignature } from "../../domain/palette";
import { formatById, frameFor, sceneScale } from "../../domain/scene";
import { useStore } from "../../state/store";

const SLOTS: Array<{ key: string; index?: number; label: string }> = [
  { key: "bg", index: 0, label: "фон 1" },
  { key: "bg", index: 1, label: "фон 2" },
  { key: "bg", index: 2, label: "фон 3" },
  { key: "ink", label: "линии" },
  { key: "obj", index: 0, label: "объект 1" },
  { key: "obj", index: 1, label: "объект 2" },
  { key: "obj", index: 2, label: "объект 3" },
  { key: "white", label: "белый" },
];

/** Мини-сцена в текущей композиции, но с черновой палитрой. */
function Preview({ palette }: { palette: Palette }) {
  const items = useStore((s) => s.items);
  const size = useStore((s) => s.size);
  const frame = frameFor(formatById("square"), size);
  const scale = items.find((item) => typeof item.scale === "number")?.scale ?? sceneScale(items, frame, size);
  const key = `draft:${paletteSignature(palette)}`;

  return (
    <svg viewBox={`0 0 ${frame.w} ${frame.h}`} className="dialogPreview" style={{ background: palette.bg[0] }}>
      {items.map((item) => {
        const shape = sprite(item.id, item.kind, size, key, palette);
        return (
          <g
            key={item.uid}
            transform={`translate(${(item.x * frame.w).toFixed(2)} ${(item.y * frame.h).toFixed(2)}) rotate(${item.rot}) scale(${scale.toFixed(4)}) translate(${-shape.w / 2} ${-shape.h / 2})`}
            dangerouslySetInnerHTML={{ __html: shape.markup }}
          />
        );
      })}
    </svg>
  );
}

export function PaletteDialog() {
  const current = useStore((s) => s.palettes[s.scheme] ?? s.palettes.a);
  const addPalette = useStore((s) => s.addPalette);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Palette>(current);
  const [json, setJson] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const color = (key: string, index?: number) =>
    index === undefined
      ? (draft[key as "ink"] as string)
      : (draft[key as "bg" | "obj"] as [string, string, string])[index];

  const setColor = (key: string, value: string, index?: number) => {
    setDraft((prev) => {
      if (index === undefined) return { ...prev, [key]: value };
      const list = [...(prev[key as "bg" | "obj"] as [string, string, string])] as [string, string, string];
      list[index] = value;
      return { ...prev, [key]: list };
    });
  };

  const applyRaw = (raw: string) => {
    const result = parsePalette(raw);
    if (!result.palette) {
      setError(result.errors[0] ?? "не разобрал");
      return;
    }
    setDraft(result.palette);
    setError(result.errors[0] ?? null);
    setJson(false);
  };

  const apply = () => {
    const result = parsePalette(JSON.stringify(draft));
    if (!result.palette) {
      setError(result.errors[0] ?? "проверь цвета");
      return;
    }
    addPalette({ ...result.palette, name: draft.name || "своя" });
    setOpen(false);
    setError(null);
  };

  const paste = async () => {
    try {
      applyRaw(await navigator.clipboard.readText());
    } catch {
      setError("буфер недоступен");
    }
  };

  const ratio = contrast(draft.ink, draft.bg[0]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(current);
          setError(null);
          setText("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button className="paletteAdd" aria-label="своя палитра" title="своя палитра">
          <Plus size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialogOverlay" />
        <Dialog.Content className="dialogPanel" aria-describedby={undefined}>
          <div className="dialogHead">
            <Dialog.Title className="t-label">своя палитра</Dialog.Title>
            <Dialog.Close asChild>
              <button className="iconBtn" aria-label="закрыть" title="закрыть">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <div className="dialogGrid">
            <div className="slots">
              {SLOTS.map((slot) => {
                const value = color(slot.key, slot.index);
                return (
                  <label key={`${slot.key}-${slot.index ?? ""}`} className="slotRow">
                    <span className="slotLabel">{slot.label}</span>
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => setColor(slot.key, event.target.value, slot.index)}
                      aria-label={slot.label}
                      className="slotSwatch"
                    />
                    <input
                      value={value}
                      onChange={(event) => setColor(slot.key, event.target.value, slot.index)}
                      className="slotHex t-mono"
                      spellCheck={false}
                      aria-label={`${slot.label}, hex`}
                    />
                  </label>
                );
              })}
              <label className="slotRow">
                <span className="slotLabel">имя</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="slotHex nameInput"
                  spellCheck={false}
                  aria-label="название палитры"
                />
              </label>
            </div>

            <div className="dialogSide">
              <Preview palette={draft} />
              {json && (
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onBlur={() => text && applyRaw(text)}
                  rows={7}
                  placeholder='{"name":"своя","bg":[…],"ink":"#…","obj":[…],"white":"#…"}'
                  className="jsonBox"
                  spellCheck={false}
                  aria-label="палитра json"
                />
              )}
              {error && <p className="uploadError">{error}</p>}
            </div>
          </div>

          <div className="dialogFooter">
            <button
              className="iconBtn"
              data-on={json}
              onClick={() => setJson((value) => !value)}
              aria-label="палитра в json"
              title="палитра в json"
            >
              <Braces size={14} />
            </button>
            <button className="iconBtn" onClick={paste} aria-label="вставить из буфера" title="вставить из буфера">
              <ClipboardPaste size={14} />
            </button>
            <span className="dialogMeta t-mono">контраст линий {ratio.toFixed(1)}:1</span>
            <button className="btnPrimary" onClick={apply}>
              <Check size={14} />
              применить
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
