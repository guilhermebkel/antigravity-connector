import { describe, expect, it } from "vitest";
import { AgyOutputFileUtil } from "@antigravity-connector/agy/Utils/AgyOutputFileUtil.ts";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const FILE_NAME = "output.png";
const HALF_LENGTH = 20;

describe("AgyOutputFileUtil.isComplete", () => {
  it("accepts a whole PNG", () => {
    const isComplete = AgyOutputFileUtil.isComplete(FILE_NAME, PNG_BYTES);

    expect(isComplete).toBe(true);
  });

  it("refuses an empty file, a cut PNG and a file that is not a PNG", () => {
    const isEmptyComplete = AgyOutputFileUtil.isComplete(FILE_NAME, new Uint8Array());
    const isCutComplete = AgyOutputFileUtil.isComplete(FILE_NAME, PNG_BYTES.subarray(0, HALF_LENGTH));
    const isTextComplete = AgyOutputFileUtil.isComplete(FILE_NAME, Buffer.from("not a png"));

    expect([isEmptyComplete, isCutComplete, isTextComplete]).toStrictEqual([false, false, false]);
  });

  it("accepts any non-empty file that is not named like a PNG", () => {
    const isComplete = AgyOutputFileUtil.isComplete("report.txt", Buffer.from("text"));

    expect(isComplete).toBe(true);
  });
});
