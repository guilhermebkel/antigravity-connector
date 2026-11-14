import { describe, expect, it } from "vitest";
import { ModelCatalogueUtil } from "@antigravity-connector/protocol/Utils/ModelCatalogueUtil.ts";

describe("ModelCatalogueUtil.resolveSlug", () => {
  it.each([
    { modelId: "gemini-3.8-flash", effort: "low", slug: "gemini-3.8-flash-low" },
    { modelId: "gemini-3.8-flash", effort: "high", slug: "gemini-3.8-flash-high" },
    { modelId: "gemini-4-argon", effort: "medium", slug: "gemini-4-argon-medium" },
  ])("maps $modelId at $effort to $slug", ({ modelId, effort, slug }) => {
    expect(ModelCatalogueUtil.resolveSlug(modelId, effort)).toBe(slug);
  });

  it("returns nothing for an unknown model id", () => {
    expect(ModelCatalogueUtil.resolveSlug("gemini-9-ultra", "low")).toBeUndefined();
  });

  it("returns nothing for an effort level this model does not support", () => {
    expect(ModelCatalogueUtil.resolveSlug("gemini-4-argon", "xhigh")).toBeUndefined();
  });

  it("returns nothing for an id that is only an inherited property name", () => {
    expect(ModelCatalogueUtil.resolveSlug("toString", "low")).toBeUndefined();
  });
});
