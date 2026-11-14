import { LayoutGrid, SlidersHorizontal } from "lucide-react";
import { ExportDialog } from "../export/ExportDialog";

export type Panel = "none" | "objects" | "view";

/** Панель для узких экранов: действия подписаны, ничего не угадываем. */
export function BottomBar({ panel, setPanel }: { panel: Panel; setPanel: (panel: Panel) => void }) {


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
      <ExportDialog variant="bottom" />
    </nav>
  );
}
