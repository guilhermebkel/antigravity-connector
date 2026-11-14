import type { AgyRunService, RunInput } from "@antigravity-connector/core";
import { RunIncompleteError } from "@antigravity-connector/core";
import type { AgyEnvelope, RunKind } from "@antigravity-connector/protocol";
import type { McpToolContext } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";

export type RunEnvelopeRequest = {
  kind: RunKind;
  source: string;
  text: string;
  model: string;
};

export class RunEnvelopeUtil {
  static readonly DOOR = "mcp";

  static async read(
    runService: AgyRunService,
    request: RunEnvelopeRequest,
    context: McpToolContext,
  ): Promise<AgyEnvelope> {
    const input: RunInput = {
      door: RunEnvelopeUtil.DOOR,
      model: request.model,
      messages: [{ role: "user", content: request.text }],
      source: request.source,
    };
    const events = runService.stream(request.kind, input, context.signal, context.observer);
    for await (const event of events) {
      if (event.kind === "finished") {
        return event.envelope;
      }
    }
    throw new RunIncompleteError();
  }
}
