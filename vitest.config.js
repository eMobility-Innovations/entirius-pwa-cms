import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

// webpack's `!!raw-loader!./x.md` (Docs view) is Vite's `./x.md?raw`.
const rawLoader = {
  name: "raw-loader-as-vite-raw",
  enforce: "pre",
  async resolveId(source, importer) {
    if (!source.startsWith("!!raw-loader!")) return null;
    const file = source.replace("!!raw-loader!", "");
    const resolved = await this.resolve(file, importer, { skipSelf: true });
    return resolved ? `${resolved.id}?raw` : null;
  },
};

export default defineConfig({
  plugins: [rawLoader, vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/unit/setup.js"],
    include: ["tests/unit/**/*.spec.{js,ts}", "src/**/*.spec.{js,ts}"],
    css: false,
  },
});
