import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
    plugins: [react(), tailwindcss()],
    // 5173 на Windows часто занимает системная служба, поэтому порт фиксируем
    server: { host: "127.0.0.1", port: 5199, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4199, strictPort: true, proxy },
  };
});
