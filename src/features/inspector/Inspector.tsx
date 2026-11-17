import { ArrowDown, ArrowUp, Copy, RotateCcw, RotateCw, Square, Trash2, X } from "lucide-react";
import { alternatives, facetsOf } from "../../domain/compose";
import { objectById } from "../../domain/library";
import { useStore } from "../../state/store";
import { TipButton } from "../../ui/TipButton";
import { PaletteDialog } from "../palette/PaletteDialog";

export function Inspector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scheme = useStore((s) => s.scheme);
  const palettes = useStore((s) => s.palettes);
  const size = useStore((s) => s.size);
  const bg = useStore((s) => s.bg);
  const items = useStore((s) => s.items);
  const selected = useStore((s) => s.selected);
  const reasons = useStore((s) => s.reasons);
  const setScheme = useStore((s) => s.setScheme);
  const setSize = useStore((s) => s.setSize);
  const setBg = useStore((s) => s.setBg);
  const select = useStore((s) => s.select);
  const remove = useStore((s) => s.remove);
  const duplicate = useStore((s) => s.duplicate);
  const reorder = useStore((s) => s.reorder);
  const rotate = useStore((s) => s.rotate);
  const toggleKind = useStore((s) => s.toggleKind);
  const replace = useStore((s) => s.replace);
  const removePalette = useStore((s) => s.removePalette);
  const format = useStore((s) => s.format);
  const setFormat = useStore((s) => s.setFormat);

  const current = items.find((i) => i.uid === selected);
  const palette = palettes[scheme] ?? palettes.a;
  const options = current ? alternatives(current.id) : [];

  return (
    <aside className="rail rail-right" data-open={open} aria-label="вид">
      <div className="sheetHead">
        <span className="t-label">вид</span>
        <button className="iconBtn" onClick={onClose} aria-label="закрыть">
          <X size={15} />
        </button>
      </div>


      {/* на узких экранах шапка прячет переключатель — он живёт здесь */}
      <div className="section formatSection">
        <div className="sectionHead">
          <span className="t-label">формат</span>
        </div>
        <div className="seg formatSeg" role="group" aria-label="формат">
          {([
            ["square", "квадрат", 13, 13],
            ["wide", "широкий", 17, 9],
            ["tall", "вертикальный", 9, 17],
          ] as const).map(([id, label, w, h]) => (
            <button key={id} data-on={format === id} onClick={() => setFormat(id)} aria-label={label} title={label}>
              <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden>
                <rect
                  className="formatGlyph"
                  x={(22 - w) / 2}
                  y={(22 - h) / 2}
                  width={w}
                  height={h}
                  rx={2}
                />
              </svg>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="sectionHead">
          <span className="t-label">цвет</span>
          <span className="t-mono">{palette.name}</span>
        </div>

        {Object.entries(palettes).map(([key, entry]) => {
          const colors = [...entry.bg, entry.ink, ...entry.obj, entry.white];
          return (
            <div key={key} className="paletteLine">
              <button
                className="paletteRow"
                data-on={scheme === key}
                aria-pressed={scheme === key}
                onClick={() => setScheme(key)}
                aria-label={`схема ${entry.name}`}
                title={entry.name}
              >
                {colors.map((color, index) => (
                  <i key={`${color}-${index}`} className="chip" style={{ background: color }} />
                ))}
              </button>
              {/^x\d+$/.test(key) && (
                <button
                  className="paletteRemove"
                  aria-label={`удалить схему ${entry.name}`}
                  title="удалить схему"
                  onClick={() => removePalette(key)}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}

        <PaletteDialog />
      </div>

      <div className="section">
        <div className="sectionHead">
          <span className="t-label">размер</span>
        </div>
        <div className="sizeRow">
          <button data-on={size === "L"} onClick={() => setSize("L")} title="крупные объекты">
            L
          </button>
          <button data-on={size === "S"} onClick={() => setSize("S")} title="мелкие объекты">
            S
          </button>
        </div>
      </div>

      <div className="section">
        <div className="sectionHead">
          <span className="t-label">фон</span>
        </div>
        <div className="choiceRow">
          <button data-on={bg === "plate"} onClick={() => setBg("plate")}>
            подложка
          </button>
          <button data-on={bg === "geometry"} onClick={() => setBg("geometry")}>
            геометрия
          </button>
          <button data-on={bg === "flat"} onClick={() => setBg("flat")}>
            цвет
          </button>
        </div>
      </div>

      <div className="section" style={{ padding: 0 }}>
        <div className="sectionHead" style={{ padding: "14px 16px 6px", margin: 0 }}>
          <span className="t-label">слои</span>
          <span className="t-mono">{items.length}</span>
        </div>
        <div className="layers">
          {[...items].reverse().map((item) => {
            const object = objectById.get(item.id);
            const reason = reasons[item.id];
            return (
              <button
                key={item.uid}
                className="layer"
                data-on={item.uid === selected}
                onClick={() => select(item.uid)}
              >
                <span className="mark" data-kind={item.kind} />
                <span className="name">{object?.name}</span>
                {reason ? <span className="t-mono">{reason.facet}</span> : null}
              </button>
            );
          })}
          {items.length === 0 && <div className="empty">пусто</div>}
        </div>

        {current && options.length > 0 && (
          <div className="replace">
            <div className="sectionHead">
              <span className="t-label">заменить</span>
              <span className="t-mono">{facetsOf(current.id)[0] ?? ""}</span>
            </div>
            <div className="replaceList">
              {options.map((id) => {
                const object = objectById.get(id);
                return (
                  <button
                    key={id}
                    className="replaceItem"
                    onClick={() => replace(id)}
                    aria-label={`заменить на ${object?.name}`}
                  >
                    {object?.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!current && (
        <p className="inspectorHint">Выберите объект на холсте, чтобы изменить его.</p>
      )}
      <div className="actions" hidden={!current}>
        <TipButton
          className="iconBtn"
          label="повернуть влево"
          keys="["
          disabled={!current}
          onClick={() => current && rotate(current.uid, current.rot - 15)}
        >
          <RotateCcw size={14} />
        </TipButton>
        <TipButton
          className="iconBtn"
          label="повернуть вправо"
          keys="]"
          disabled={!current}
          onClick={() => current && rotate(current.uid, current.rot + 15)}
        >
          <RotateCw size={14} />
        </TipButton>
        <TipButton className="iconBtn" label="главный или фоновый" disabled={!current} onClick={toggleKind}>
          <Square size={13} />
        </TipButton>
        <TipButton
          className="iconBtn"
          label="дублировать"
          keys="Ctrl D"
          disabled={!current}
          onClick={duplicate}
        >
          <Copy size={13} />
        </TipButton>
        <TipButton
          className="iconBtn"
          label="выше слоем"
          disabled={!current}
          onClick={() => reorder(1)}
        >
          <ArrowUp size={14} />
        </TipButton>
        <TipButton
          className="iconBtn"
          label="ниже слоем"
          disabled={!current}
          onClick={() => reorder(-1)}
        >
          <ArrowDown size={14} />
        </TipButton>
        <TipButton
          className="iconBtn"
          label="удалить"
          keys="Delete"
          disabled={!current}
          onClick={remove}
          style={{ marginLeft: "auto" }}
        >
          <Trash2 size={13} />
        </TipButton>
      </div>
    </aside>
  );
}
