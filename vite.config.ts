import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Спрайты лежат рядом с исходниками макета и раздаются как статика: сборка
 * просто раскладывает их в public/sprites, чтобы приложение брало файл целиком,
 * а не держало всю библиотеку в JavaScript.
 */
function sprites(): Plugin {
  const from = resolve("assets/source");
  const to = resolve("public/sprites");

  return {
    name: "sprites",
    buildStart() {
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  // ключ живёт только на сервере: без префикса VITE_ он не попадает в бандл
  const env = loadEnv(mode, ".", "");
  const key = env.DEEPSEEK_KEY;

  const proxy = key
    ? {
        "/api/deepseek": {
          target: "https://api.deepseek.com",
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/deepseek/, ""),
          headers: { Authorization: `Bearer ${key}` },
        },
      }
    : undefined;

  return {
    plugins: [react(), tailwindcss(), sprites()],
    server: { host: "127.0.0.1", proxy },
    preview: { host: "127.0.0.1", proxy },
  };
});
