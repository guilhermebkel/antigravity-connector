import { describe, it, expect } from "vitest";
import config, { buildQualityCommand, buildLintCommand, buildRelatedTestsCommand, buildTypecheckCommand } from "./lint-staged.config.mjs";

const CWD = process.cwd().replaceAll("\\", "/");
const UTIL = `${CWD}/packages/core/src/Utils/EnvUtil.ts`;
const UTIL_TEST = `${CWD}/packages/core/src/Utils/EnvUtil.test.ts`;

describe("lint-staged config", () => {
  it("lints the changed files without --fix", () => {
    expect(buildLintCommand([UTIL, UTIL_TEST])).toBe(`node scripts/lint.mjs --max-warnings=0 "${UTIL}" "${UTIL_TEST}"`);
  });

  it("runs the tests that import the changed files", () => {
    expect(buildRelatedTestsCommand([UTIL])).toBe(`vitest related --run --passWithNoTests "${UTIL}"`);
  });

  it("typechecks every package with no file arguments", () => {
    expect(buildTypecheckCommand([UTIL, UTIL_TEST])).toBe("pnpm typecheck");
  });

  it("runs the whole-project quality tools once for source changes", () => {
    expect(config["**/*.{ts,tsx,mjs}"]).toContain(buildQualityCommand);
  });

  it("keeps the typecheck on typescript files only", () => {
    expect(config["**/*.{ts,tsx}"]).toBe(buildTypecheckCommand);
  });
});
