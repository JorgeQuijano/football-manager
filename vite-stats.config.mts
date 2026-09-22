import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  base: "/football-manager/",
  define: { __APP_VERSION__: JSON.stringify("stats") },
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ filename: "stats.json", template: "raw-data", gzipSize: true })
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  }
});
