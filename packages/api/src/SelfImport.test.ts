import { describe, expect, it } from "vitest";
import * as apiRoot from "@antigravity-connector/api/index.ts";

describe("package self-reference", () => {
  it("resolves a file of its own package through the package name, without a build step", () => {
    expect(typeof apiRoot).toBe("object");
  });
});
