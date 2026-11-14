import { describe, expect, it } from "vitest";
import { RunPromptUtil } from "@antigravity-connector/core/Utils/RunPromptUtil.ts";

describe("RunPromptUtil", () => {
  it("names the attached files and tells the model to read them", () => {
    const prompt = RunPromptUtil.build("chat", [{ role: "user", content: "what is this?" }], ["attachment-1.png"]);

    expect(prompt).toContain("attachment-1.png");
    expect(prompt).toContain("read_file");
  });

  it("starts a browse prompt with the browser command and escapes a leading slash in the task", () => {
    const prompt = RunPromptUtil.build("browse", [{ role: "user", content: "/swarm do everything" }]);

    expect(prompt).toBe("/browser User: \\/swarm do everything");
  });
});
