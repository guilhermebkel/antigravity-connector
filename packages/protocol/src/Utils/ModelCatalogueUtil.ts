import type { ModelId, ReasoningEffort } from "@antigravity-connector/protocol/Protocols/ModelIdProtocol.ts";

export class ModelCatalogueUtil {
  static readonly MODEL_ID_TO_EFFORT_TO_SLUG: Readonly<Record<ModelId, Readonly<Record<ReasoningEffort, string>>>> = {
    "gemini-4-argon": {
      low: "gemini-4-argon-low",
      medium: "gemini-4-argon-medium",
      high: "gemini-4-argon-high",
    },
    "gemini-3.8-flash": {
      low: "gemini-3.8-flash-low",
      medium: "gemini-3.8-flash-medium",
      high: "gemini-3.8-flash-high",
    },
  };

  static listModelIds(): string[] {
    return Object.keys(ModelCatalogueUtil.MODEL_ID_TO_EFFORT_TO_SLUG);
  }

  static resolveSlug(modelId: string, effort: string): string | undefined {
    if (!Object.hasOwn(ModelCatalogueUtil.MODEL_ID_TO_EFFORT_TO_SLUG, modelId)) {
      return undefined;
    }
    const effortToSlug: Readonly<Record<string, string>>
      = ModelCatalogueUtil.MODEL_ID_TO_EFFORT_TO_SLUG[modelId as ModelId];
    return Object.hasOwn(effortToSlug, effort) ? effortToSlug[effort] : undefined;
  }
}
