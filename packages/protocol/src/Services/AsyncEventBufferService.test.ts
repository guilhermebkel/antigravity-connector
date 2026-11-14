import { describe, expect, it } from "vitest";
import { AsyncEventBufferService } from "@antigravity-connector/protocol/Services/AsyncEventBufferService.ts";

const collect = async (buffer: AsyncEventBufferService<string>): Promise<string[]> => {
  const values: string[] = [];
  for await (const value of buffer.readItems()) {
    values.push(value);
  }
  return values;
};

describe("AsyncEventBufferService", () => {
  it("yields the items pushed before and after the consumer starts, in order", async () => {
    const buffer = new AsyncEventBufferService<string>();
    buffer.push("a");
    const collected = collect(buffer);
    buffer.push("b");
    buffer.end();

    expect(await collected).toStrictEqual(["a", "b"]);
  });

  it("delivers the items already pushed before the error, then throws the error", async () => {
    const buffer = new AsyncEventBufferService<string>();
    buffer.push("delta");
    buffer.end(new Error("stream broke"));

    const values: string[] = [];
    const runRead = async (): Promise<void> => {
      for await (const value of buffer.readItems()) {
        values.push(value);
      }
    };

    await expect(runRead()).rejects.toThrow("stream broke");
    expect(values).toStrictEqual(["delta"]);
  });

  it("ignores a second end", async () => {
    const buffer = new AsyncEventBufferService<string>();
    buffer.end();
    buffer.end(new Error("late"));

    expect(await collect(buffer)).toStrictEqual([]);
  });
});
