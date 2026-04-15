import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/lib/**"],
      exclude: ["src/domain/expiryJob.ts"],
    },
    // Timeout más alto para operaciones de BD (tests de integración)
    testTimeout: 15_000,
  },
});
