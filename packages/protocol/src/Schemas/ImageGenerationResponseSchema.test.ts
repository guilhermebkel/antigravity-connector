import { describe, expect, it } from "vitest";
import { ImageGenerationResponseSchema } from "@antigravity-connector/protocol/Schemas/ImageGenerationResponseSchema.ts";

describe("ImageGenerationResponseSchema", () => {
  it("parses an image response with one base64 image", () => {
    const body = { created: 1700000000, data: [{ b64_json: "aGVsbG8=" }] };

    const result = ImageGenerationResponseSchema.safeParse(body);

    expect(result.data).toStrictEqual(body);
  });
});
