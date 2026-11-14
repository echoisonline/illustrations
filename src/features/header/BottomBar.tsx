import { Download, Image as ImageIcon, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { formatById, frameFor } from "../../domain/scene";
import { exportPng, exportSvg } from "../export";
import { useStore } from "../../state/store";

export type Panel = "none" | "objects" | "view";

/** Панель для узких экранов: действия подписаны, ничего не угадываем. */
export function BottomBar({ panel, setPanel }: { panel: Panel; setPanel: (panel: Panel) => void }) {
  const format = useStore((s) => s.format);
  const scheme = useStore((s) => s.scheme);
  const size = useStore((s) => s.size);
  const current = frameFor(formatById(format), size);
  const tag = `${scheme}${size}`;

  return (
    <nav className="bottomBar" aria-label="панели и экспорт">
      <button
        className="bottomItem"
        data-on={panel === "objects"}
        onClick={() => setPanel(panel === "objects" ? "none" : "objects")}
      >
        <LayoutGrid size={17} />
        объекты
      </button>
      <button
        className="bottomItem"
        data-on={panel === "view"}
        onClick={() => setPanel(panel === "view" ? "none" : "view")}
      >
        <SlidersHorizontal size={17} />
        вид
      </button>
      <button className="bottomItem" onClick={() => exportSvg(current, tag)}>
        <Download size={17} />
        svg
      </button>
      <button className="bottomItem" onClick={() => exportPng(current, tag)}>
        <ImageIcon size={17} />
        png
      </button>
    </nav>
  );
}
