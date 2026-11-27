import { describe, expect, it } from "vitest";
import { UploadReferenceUtil } from "@antigravity-connector/core/Utils/UploadReferenceUtil.ts";

const UPLOAD_ID = "AbCdEfGhIjKlMnOpQrSt_-";

describe("UploadReferenceUtil", () => {
  it("writes a reference as the upload: prefix followed by the image id", () => {
    expect(UploadReferenceUtil.build(UPLOAD_ID)).toBe("upload:AbCdEfGhIjKlMnOpQrSt_-");
  });

  it("reads the image id back from a reference it wrote", () => {
    const reference = UploadReferenceUtil.build(UPLOAD_ID);
    expect(UploadReferenceUtil.readUploadId(reference)).toBe(UPLOAD_ID);
  });

  it.each([
    ["upload:short"],
    ["upload:AbCdEfGhIjKlMnOpQrSt_-X"],
    ["upload:AbCdEfGhIjKlMnOpQrSt_/"],
    ["AbCdEfGhIjKlMnOpQrSt_-"],
    ["https://upload:AbCdEfGhIjKlMnOpQrSt_-"],
    ["upload:AbCdEfGhIjKlMnOpQrSt_-\n"],
  ])("reads no image id from %j", (reference) => {
    expect(UploadReferenceUtil.readUploadId(reference)).toBeUndefined();
  });
});
