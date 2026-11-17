import { GripVertical, X } from "lucide-react";
import { useEffect, type DragEvent } from "react";
import { hasSprite, objects, sprite } from "../../domain/library";
import { contentBox, contentViewBox } from "../../domain/library/measure";
import { useStore } from "../../state/store";
import { useSprites } from "../../state/sprites";

export const DRAG_TYPE = "text/illustration-object";

export function LibraryRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const size = useStore((s) => s.size);
  const scheme = useStore((s) => s.scheme);
  const palettes = useStore((s) => s.palettes);
  const add = useStore((s) => s.add);
  const palette = palettes[scheme] ?? palettes.a;
  // плитки догружаются в фоне: экран не ждёт двадцать превью
  useSprites((s) => s.version);
  const requestSprites = useSprites((s) => s.request);

  useEffect(() => {
    requestSprites(objects.map((object) => object.sizes[size].main.file));
  }, [size]);

  const startDrag = (event: DragEvent<HTMLButtonElement>, id: string) => {
    event.dataTransfer.setData(DRAG_TYPE, id);
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "copy";
    // на узком экране плитка закрывает сцену — прячем её, чтобы было куда бросить
    onClose();
  };

  return (
    <aside className="rail rail-left" data-open={open} aria-label="библиотека">
      <div className="sheetHead">
        <span className="t-label">объекты</span>
        <button className="iconBtn" onClick={onClose} aria-label="закрыть">
          <X size={15} />
        </button>
      </div>

      <div className="libraryIntro">
        <span className="t-label">Библиотека</span>
      </div>
      <div className="objects">
        {objects.map((object) => {
          const file = object.sizes[size].main.file;
          // пока разметки нет, плитка остаётся пустой рамкой
          if (!hasSprite(file)) {
            return (
              <button key={object.id} className="object" disabled aria-label={object.name}>
                <span className="objectArt" />
                <span className="objectName">{object.name}</span>
              </button>
            );
          }
          const shape = sprite(object.id, "main", size, scheme, palette);
          const key = `${object.id}:${size}:${scheme}`;
          const box = contentBox(key, shape.markup, shape.w, shape.h);
          return (
            <button
              key={object.id}
              className="object"
              draggable
              onDragStart={(event) => startDrag(event, object.id)}
              onClick={() => {
                add(object.id);
                onClose();
              }}
              aria-label={`добавить ${object.name}`}
              title={`добавить ${object.name}`}
            >
              <span className="objectArt">
                <svg viewBox={contentViewBox(box, 0.06)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: shape.markup }} />
              </span>
              <span className="objectName">{object.name}</span>
              <GripVertical className="objectGrip" size={13} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
