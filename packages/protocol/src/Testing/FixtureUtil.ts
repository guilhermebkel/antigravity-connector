import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export class FixtureUtil {
  static readText(fileName: string): string {
    const filePath = resolve(import.meta.dirname, "fixtures", fileName);
    return readFileSync(filePath, "utf8");
  }

  static readJson(fileName: string): unknown {
    const text = FixtureUtil.readText(fileName);
    return JSON.parse(text);
  }

  static readLines(fileName: string): string[] {
    return FixtureUtil.readText(fileName)
      .split("\n")
      .filter((line) => line.trim() !== "");
  }
}
