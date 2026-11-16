import { describe, expect, it } from "vitest";
import { UploadReferenceUtil } from "@antigravity-connector/core/Utils/UploadReferenceUtil.ts";

const IMAGE_ID = "AbCdEfGhIjKlMnOpQrSt_-";

describe("UploadReferenceUtil", () => {
  it("writes a reference as the upload: prefix followed by the image id", () => {
    expect(UploadReferenceUtil.build(IMAGE_ID)).toBe("upload:AbCdEfGhIjKlMnOpQrSt_-");
  });

  it("reads the image id back from a reference it wrote", () => {
    const reference = UploadReferenceUtil.build(IMAGE_ID);
    expect(UploadReferenceUtil.readImageId(reference)).toBe(IMAGE_ID);
  });

  it.each([
    ["upload:short"],
    ["upload:AbCdEfGhIjKlMnOpQrSt_-X"],
    ["upload:AbCdEfGhIjKlMnOpQrSt_/"],
    ["AbCdEfGhIjKlMnOpQrSt_-"],
    ["https://upload:AbCdEfGhIjKlMnOpQrSt_-"],
    ["upload:AbCdEfGhIjKlMnOpQrSt_-\n"],
  ])("reads no image id from %j", (reference) => {
    expect(UploadReferenceUtil.readImageId(reference)).toBeUndefined();
  });
});
