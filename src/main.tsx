import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("нет #root");

// спрайты грузятся по одному уже в интерфейсе: экран не ждёт всю библиотеку
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
