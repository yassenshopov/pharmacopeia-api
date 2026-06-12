import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // The static repository validates the full seed dataset (Zod over
    // ~310 drugs) at construction, so the first test touching it pays
    // a noticeable startup cost.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
