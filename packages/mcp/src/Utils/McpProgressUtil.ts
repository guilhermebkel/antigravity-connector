import type { RunProgressEvent } from "@antigravity-connector/core";

export class McpProgressUtil {
  static readonly IMMEDIATE_KINDS: readonly RunProgressEvent["kind"][] = ["queued", "started"];

  static readonly STEP_TYPE_TO_MESSAGE: Readonly<Record<"user_input" | "agent_response" | "tool", string>> = {
    user_input: "Reading the request.",
    agent_response: "Writing the answer.",
    tool: "Using a tool.",
  };

  static readonly TEXT_MESSAGE = "Writing the answer.";

  static readonly STARTED_MESSAGE = "Started the run.";

  static readonly DEFAULT_MESSAGE = "Still working.";

  static isImmediate(event: RunProgressEvent): boolean {
    return McpProgressUtil.IMMEDIATE_KINDS.includes(event.kind);
  }

  static describe(event: RunProgressEvent): string {
    const lifecycle = McpProgressUtil.readQueued(event) ?? McpProgressUtil.readStarted(event);
    const repeated = McpProgressUtil.readText(event) ?? McpProgressUtil.readActivity(event);
    return lifecycle ?? repeated ?? McpProgressUtil.DEFAULT_MESSAGE;
  }

  static readQueued(event: RunProgressEvent): string | undefined {
    if (event.kind !== "queued") {
      return undefined;
    }
    return `Waiting in the agy queue at position ${event.position}.`;
  }

  static readStarted(event: RunProgressEvent): string | undefined {
    if (event.kind !== "started") {
      return undefined;
    }
    return McpProgressUtil.STARTED_MESSAGE;
  }

  static readText(event: RunProgressEvent): string | undefined {
    if (event.kind !== "text") {
      return undefined;
    }
    return McpProgressUtil.TEXT_MESSAGE;
  }

  static readActivity(event: RunProgressEvent): string | undefined {
    if (event.kind !== "activity") {
      return undefined;
    }
    return McpProgressUtil.STEP_TYPE_TO_MESSAGE[event.stepType];
  }
}
