import { describe, expect, it } from "vitest";
import { AgyOutputFileUtil } from "@antigravity-connector/agy/Utils/AgyOutputFileUtil.ts";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const FILE_NAME = "output.png";
const PICTURE_NAME = "picture.jpg";
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

  it("a JPEG is complete only with its start and end markers", () => {
    const whole = AgyOutputFileUtil.isComplete(PICTURE_NAME, Buffer.from("ffd8ffe0ffd9", "hex"));
    const cut = AgyOutputFileUtil.isComplete(PICTURE_NAME, Buffer.from("ffd8ffe0", "hex"));
    expect(whole).toBe(true);
    expect(cut).toBe(false);
  });

  it("picks the expected name when it is there, else the one picture that is not an attachment", () => {
    const withExpected = AgyOutputFileUtil.pickTarget(["output.png", "a.jpg"], FILE_NAME, []);
    const otherName = AgyOutputFileUtil.pickTarget([PICTURE_NAME, "notes.txt"], FILE_NAME, []);
    const withAttachment = AgyOutputFileUtil.pickTarget(["attachment-1.png", PICTURE_NAME], FILE_NAME, ["attachment-1.png"]);

    expect(withExpected).toBe(FILE_NAME);
    expect(otherName).toBe(PICTURE_NAME);
    expect(withAttachment).toBe(PICTURE_NAME);
  });

  it("gives no picture when two candidates are there without the expected name, or none at all", () => {
    const twoCandidates = AgyOutputFileUtil.pickTarget(["a.jpg", "b.png"], FILE_NAME, []);
    const none = AgyOutputFileUtil.pickTarget(["notes.txt"], FILE_NAME, []);

    expect(twoCandidates).toBeUndefined();
    expect(none).toBeUndefined();
  });
});
