import { describe, expect, it } from "vitest";
import { ModelListSchema } from "@antigravity-connector/protocol/Schemas/ModelListSchema.ts";

describe("ModelListSchema", () => {
  it("parses a model list with the public ids", () => {
    const body = {
      object: "list",
      data: [
        { id: "gemini-4-argon", object: "model", created: 1700000000, owned_by: "antigravity-connector" },
        { id: "gemini-3.8-flash", object: "model", created: 1700000000, owned_by: "antigravity-connector" },
      ],
    };

    const result = ModelListSchema.safeParse(body);

    expect(result.data).toStrictEqual(body);
  });
});
