import { ArrowDown, ArrowUp, Copy, RotateCcw, RotateCw, Square, Trash2, X } from "lucide-react";
import { alternatives, facetsOf } from "../../domain/compose";
import { objectById } from "../../domain/library";
import { useStore } from "../../state/store";
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
            const reason = reasons[item.uid];
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

      <div className="actions">
        <button
          className="iconBtn"
          aria-label="повернуть влево"
          title="повернуть влево"
          disabled={!current}
          onClick={() => current && rotate(current.uid, current.rot - 15)}
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="iconBtn"
          aria-label="повернуть вправо"
          title="повернуть вправо"
          disabled={!current}
          onClick={() => current && rotate(current.uid, current.rot + 15)}
        >
          <RotateCw size={14} />
        </button>
        <button
          className="iconBtn"
          aria-label="главный или фоновый"
          title="главный или фоновый рисунок"
          disabled={!current}
          onClick={toggleKind}
        >
          <Square size={13} />
        </button>
        <button className="iconBtn" aria-label="дублировать" title="дублировать" disabled={!current} onClick={duplicate}>
          <Copy size={13} />
        </button>
        <button className="iconBtn" aria-label="выше" title="выше слоем" disabled={!current} onClick={() => reorder(1)}>
          <ArrowUp size={14} />
        </button>
        <button className="iconBtn" aria-label="ниже" title="ниже слоем" disabled={!current} onClick={() => reorder(-1)}>
          <ArrowDown size={14} />
        </button>
        <button
          className="iconBtn"
          aria-label="удалить"
          title="удалить"
          disabled={!current}
          onClick={remove}
          style={{ marginLeft: "auto" }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </aside>
  );
}
