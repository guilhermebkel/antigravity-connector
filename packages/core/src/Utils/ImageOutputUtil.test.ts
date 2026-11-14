import { describe, expect, it } from "vitest";
import { ImageInvalidError } from "@antigravity-connector/core/Errors/ImageInvalidError.ts";
import { ImageOutputUtil } from "@antigravity-connector/core/Utils/ImageOutputUtil.ts";

const PNG_HEADER = [137, 80, 78, 71, 13, 10, 26, 10];

describe("ImageOutputUtil", () => {
  it("accepts a file that starts with the PNG signature", () => {
    expect(() => {
      ImageOutputUtil.assertPng(new Uint8Array([...PNG_HEADER, 0, 0, 0, 0]));
    }).not.toThrow();
  });

  it("refuses a file without the PNG signature, and a file that is too short for it", () => {
    expect(() => {
      ImageOutputUtil.assertPng(new TextEncoder().encode("not a png"));
    }).toThrow(ImageInvalidError);
    expect(() => {
      ImageOutputUtil.assertPng(new Uint8Array([137, 80]));
    }).toThrow(ImageInvalidError);
  });

  it("refuses a file over the size cap, even with the PNG signature", () => {
    const oversize = new Uint8Array(ImageOutputUtil.MAX_BYTES + 1);
    oversize.set(PNG_HEADER, 0);
    expect(() => {
      ImageOutputUtil.assertPng(oversize);
    }).toThrow(/larger than 8 MB/);
  });
});
