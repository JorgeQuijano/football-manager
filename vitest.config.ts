import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    // a twenty-club world is twice the work: a full season is ~4-5 s of engine time
    testTimeout: 120_000,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"]
  }
});
