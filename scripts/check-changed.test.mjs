import { describe, it, expect } from "vitest";
import { isSharedRoot, planCheck } from "./check-changed.mjs";

describe("planCheck()", () => {
  it("checks only the changed files when nothing shared changed", () => {
    expect(planCheck({ base: "abc", changedPaths: ["apps/server/src/Utils/TimeUtil.ts", "packages/core/src/Utils/EnvUtil.ts"] })).toStrictEqual({ kind: "changed", base: "abc" });
  });

  it("runs the full check and says why when the base cannot be resolved", () => {
    expect(planCheck({ base: null, changedPaths: [] })).toStrictEqual({ kind: "full", reason: "origin/master could not be resolved" });
  });

  it.each(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "tsconfig.json", "eslint.config.mjs", ".oxlintrc.json", "knip.json", "vitest.config.mjs", "scripts/lint.mjs", "lint-staged.config.mjs", "scripts/check-changed.mjs", "packages/protocol/src/index.ts", "packages/tooling/eslint-local-rules.mjs", ".github/workflows/ci.yml"])(
    "runs the full check when %s changed",
    (path) => {
      expect(planCheck({ base: "abc", changedPaths: ["apps/server/src/Utils/TimeUtil.ts", path] })).toStrictEqual({ kind: "full", reason: `${path} is a shared root` });
    },
  );
});

describe("isSharedRoot()", () => {
  it("leaves ordinary source files out", () => {
    expect(isSharedRoot("apps/server/src/Protocolsish.ts")).toBe(false);
    expect(isSharedRoot("packages/core/src/package.json.ts")).toBe(false);
    expect(isSharedRoot("packages/agy/src/index.ts")).toBe(false);
  });
});
