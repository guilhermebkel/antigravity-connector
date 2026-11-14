import { defineConfig } from "vitest/config";

// Why: the e2e suite runs the built bundle as a real process, so it has its own config and is not part of the default `pnpm test`.
const TWO_MINUTES_MS = 120000;

export default defineConfig({
  test: {
    include: ["scripts/harness/*.e2e.test.mjs"],
    testTimeout: TWO_MINUTES_MS,
    hookTimeout: TWO_MINUTES_MS,
  },
});
