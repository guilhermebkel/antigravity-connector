import { describe, expect, it } from "vitest";
import { RunPromptUtil } from "@antigravity-connector/core/Utils/RunPromptUtil.ts";

const REFERENCE_NAME = "attachment-1.png";
const IMAGE_REQUEST = "a red circle";

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

describe("RunPromptUtil for image runs", () => {
  it("AC1: an image run tells the model to reply only after output.png exists, not to promise a later report", () => {
    const prompt = RunPromptUtil.build("image", [{ role: "user", content: IMAGE_REQUEST }]);

    expect(prompt).toContain("Reply only after output.png exists in the current directory");
    expect(prompt).toContain("Do not reply with a promise to report later");
  });

  it("AC2: an image run with a reference image still tells the model to read it before making the picture", () => {
    const prompt = RunPromptUtil.build("image", [{ role: "user", content: IMAGE_REQUEST }], [REFERENCE_NAME]);

    expect(prompt).toContain("Read each one with the read_file tool");
    expect(prompt).toContain("Reply only after output.png exists");
  });

  it("AC3: chat, search, research and browse instructions are unchanged", () => {
    expect(RunPromptUtil.RUN_KIND_TO_INSTRUCTION.chat).toBe(
      "Answer the conversation directly. Do not search the web and do not edit files.",
    );
    expect(RunPromptUtil.RUN_KIND_TO_INSTRUCTION.search).toBe(
      "Answer briefly and list the source URLs you used. Use the web search tool.",
    );
    expect(RunPromptUtil.RUN_KIND_TO_INSTRUCTION.research).toBe(
      "Write a Markdown report on the request, with a link to every source you used.",
    );
    expect(RunPromptUtil.RUN_KIND_TO_INSTRUCTION.browse).toBe("");
  });
});

describe("RunPromptUtil for reference images", () => {
  it("an image run with attachments says they are reference images, and names them", () => {
    const prompt = RunPromptUtil.build("image", [{ role: "user", content: IMAGE_REQUEST }], [REFERENCE_NAME]);
    expect(prompt).toContain("reference images");
    expect(prompt).toContain(REFERENCE_NAME);
  });
});
