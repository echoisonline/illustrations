import { useEffect, useState } from "react";
import { Header } from "../features/header/Header";
import { BottomBar, type Panel } from "../features/header/BottomBar";
import { LibraryRail } from "../features/library/LibraryRail";
import { Inspector } from "../features/inspector/Inspector";
import { Stage } from "../features/canvas/Stage";
import { useStore } from "../state/store";

/** первый показ: сцена сразу собирается под стартовую тему, уже с моделью */
let started = false;

export function App() {
  const scheme = useStore((s) => s.scheme);
  const palettes = useStore((s) => s.palettes);
  const [panel, setPanel] = useState<Panel>("none");
  const accent = (palettes[scheme] ?? palettes.a).bg[2];
  const close = () => setPanel("none");

  useEffect(() => {
    if (started) return;
    started = true;
    const state = useStore.getState();
    if (state.brief.trim()) state.run();
  }, []);

  useEffect(() => {
    if (panel === "none") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  return (
    <div className="shell" style={{ ["--accent" as string]: accent }}>
      <Header />
      <div className="main">
        <LibraryRail open={panel === "objects"} onClose={close} />
        <Stage />
        <Inspector open={panel === "view"} onClose={close} />
      </div>
      <BottomBar panel={panel} setPanel={setPanel} />
      <div className="scrim" data-open={panel !== "none"} onClick={close} aria-hidden="true" />
    </div>
  );
}
