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

  it("gives the mime type from the bytes, so a JPEG is a JPEG whatever its name", () => {
    const png = ImageOutputUtil.assertImage(Buffer.from("89504e470d0a1a0a00", "hex"));
    const jpeg = ImageOutputUtil.assertImage(Buffer.from("ffd8ffe0ffd9", "hex"));

    expect(png).toBe("image/png");
    expect(jpeg).toBe("image/jpeg");
  });

  it("refuses bytes that are neither a PNG nor a JPEG", () => {
    const text = Buffer.from("not a picture");

    expect(() => {
      ImageOutputUtil.assertImage(text);
    }).toThrow(/not a PNG or JPEG image/);
  });

  it("prefers output.png, else takes the first picture of the run", () => {
    const png = Buffer.from("89504e470d0a1a0a00", "hex");
    const jpeg = Buffer.from("ffd8ffe0ffd9", "hex");
    const preferred = ImageOutputUtil.findImage({ "output.png": png, "a.jpg": jpeg });
    const other = ImageOutputUtil.findImage({ "picture.jpg": jpeg });
    const notAPicture = ImageOutputUtil.findImage({ "notes.txt": jpeg });

    expect(preferred).toBe(png);
    expect(other).toBe(jpeg);
    expect(notAPicture).toBeUndefined();
  });
});
