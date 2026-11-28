import { describe, expect, it } from "vitest";
import { ModelIdSchema } from "@antigravity-connector/protocol/Schemas/ModelIdSchema.ts";
import { ModelCatalogueUtil } from "@antigravity-connector/protocol/Utils/ModelCatalogueUtil.ts";
import { ModelInfoUtil } from "@antigravity-connector/protocol/Utils/ModelInfoUtil.ts";

describe("ModelInfoUtil", () => {
  it("describes exactly the models of the catalogue, and the schema accepts each of them", () => {
    const described = Object.keys(ModelInfoUtil.MODEL_ID_TO_DESCRIPTION).sort();
    expect(described).toStrictEqual([...ModelCatalogueUtil.listModelIds()].sort());
    for (const id of described) {
      expect(ModelIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it("lists each model with its description in the field description of a tool", () => {
    const text = ModelInfoUtil.buildFieldDescription("Hint.");
    expect(text.startsWith("Hint. Models: ")).toBe(true);
    for (const [id, description] of Object.entries(ModelInfoUtil.MODEL_ID_TO_DESCRIPTION)) {
      expect(text).toContain(`${id}: ${description}`);
    }
  });
});
