import { defineConfig } from "vitest/config";

// Why: the harness scripts have no workspace of their own, so they get an inline project; every app and package is a project through its folder.
const MINUTE_MS = 60_000;

export default defineConfig({
  test: {
    // Why: the packages start empty and gain tests one issue at a time; an empty project is not a failure.
    passWithNoTests: true,
    projects: [
      "apps/*",
      "packages/*",
      {
        test: {
          name: "scripts",
          include: ["scripts/*.test.mjs", "lint-staged.config.test.mjs"],
          testTimeout: MINUTE_MS,
          hookTimeout: MINUTE_MS,
        },
      },
    ],
  },
});
