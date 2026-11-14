import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // домен проверяем без браузера: contentBox в этом случае берёт размеры
    // из манифеста, а не из getBBox
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
  },
});
