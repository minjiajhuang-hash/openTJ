import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": `${projectRoot}src`,
    },
  },
  test: {
    environment: "node",
    globals: true,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    passWithNoTests: false,
    testTimeout: 10_000,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
      exclude: [
        "src/lib/generated/**",
        "src/**/*.d.ts",
        "src/**/types.ts",
      ],
    },
  },
});
