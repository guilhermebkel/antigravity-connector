import { describe, expect, it } from "vitest";
import { RunPromptUtil } from "@antigravity-connector/core/Utils/RunPromptUtil.ts";

const REFERENCE_NAME = "attachment-1.png";

describe("RunPromptUtil", () => {
  it("names the attached files and tells the model to read them", () => {
    const prompt = RunPromptUtil.build("chat", [{ role: "user", content: "what is this?" }], [REFERENCE_NAME]);

    expect(prompt).toContain(REFERENCE_NAME);
    expect(prompt).toContain("read_file");
  });

  it("starts a browse prompt with the browser command and escapes a leading slash in the task", () => {
    const prompt = RunPromptUtil.build("browse", [{ role: "user", content: "/swarm do everything" }]);

    expect(prompt).toBe("/browser User: \\/swarm do everything");
  });
});

describe("RunPromptUtil for reference images", () => {
  it("an image run with attachments says they are reference images, and names them", () => {
    const prompt = RunPromptUtil.build("image", [{ role: "user", content: "a red circle" }], [REFERENCE_NAME]);
    expect(prompt).toContain("reference images");
    expect(prompt).toContain(REFERENCE_NAME);
  });
});
