import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { loadSprites } from "./domain/library";
import "./styles/global.css";

/**
 * Разметку спрайтов держим вне бандла: один запрос до первого рендера, дальше
 * всё синхронно. Так JavaScript не тянет полтора мегабайта SVG на старте.
 */
async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) throw new Error("нет #root");

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sprites.json`);
    if (!response.ok) throw new Error(String(response.status));
    loadSprites((await response.json()) as Record<string, string>);
  } catch (error) {
    root.textContent = "не удалось загрузить библиотеку иллюстраций";
    throw error;
  }

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
