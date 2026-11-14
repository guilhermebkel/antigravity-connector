import { describe, expect, it } from "vitest";
import { ImageGenerationRequestSchema } from "@antigravity-connector/protocol/Schemas/ImageGenerationRequestSchema.ts";

describe("ImageGenerationRequestSchema", () => {
  it("parses a prompt with the optional fields", () => {
    const body = { prompt: "a red circle", model: "gemini-3.8-flash", n: 1, size: "256x256", response_format: "b64_json" };

    const result = ImageGenerationRequestSchema.safeParse(body);

    expect(result.data).toStrictEqual(body);
  });

  it("names prompt when it is empty", () => {
    const result = ImageGenerationRequestSchema.safeParse({ prompt: "" });

    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["prompt"]]);
  });
});
