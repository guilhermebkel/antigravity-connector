import { describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { ChatCompletionService } from "@antigravity-connector/api/Services/ChatCompletionService.ts";
import { ConversationRegistryService } from "@antigravity-connector/api/Services/ConversationRegistryService.ts";
import type { ChatCompletionRequest } from "@antigravity-connector/protocol";

const CLOCK_MS = 1700000000000;
const SCHEMA_FORMAT = { type: "json_schema" as const, json_schema: { name: "x", schema: { type: "object" } } };

const buildService = (respond?: () => Promise<StubRunResult>) => {
  const stub = StubRuntimeUtil.build(respond === undefined ? {} : { respond });
  const conversations = new ConversationRegistryService({ clock: () => CLOCK_MS });
  const service = new ChatCompletionService({ runService: stub.runService, clock: () => CLOCK_MS, conversations });
  return { stub, service };
};

const buildRequest = (overrides: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest => ({
  model: "gemini-3.8-flash",
  messages: [{ role: "user", content: "first" }],
  ...overrides,
});

const captureError = async (pending: Promise<unknown>): Promise<unknown> => {
  const error: unknown = await pending.then(() => undefined, (caught: unknown) => caught);
  return error;
};

const buildStructuredResult = (): Promise<StubRunResult> => {
  const base = StubRuntimeUtil.buildResult("");
  return Promise.resolve({ ...base, envelope: { ...base.envelope, structured_output: { answer: "ok" } } });
};

describe("ChatCompletionService conversations", () => {
  it("AC2: an unknown conversation_id is refused and no run starts", async () => {
    const { stub, service } = buildService();
    const pending = service.complete(buildRequest({ conversation_id: "conv-unknown" }));
    const error = await captureError(pending);

    expect(error).toMatchObject({ param: "conversation_id" });
    expect(stub.requests).toHaveLength(0);
  });

  it("AC1: a known conversation_id sends only the last user message with the id", async () => {
    const { stub, service } = buildService();
    const first = await service.complete(buildRequest());
    const conversationId = first.body.conversation_id;
    const followUp = buildRequest({
      conversation_id: conversationId,
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "second" },
      ],
    });
    await service.complete(followUp);
    const secondRequest = stub.requests[1];

    expect(secondRequest?.conversationId).toBe(conversationId);
    expect(secondRequest?.prompt).toContain("second");
    expect(secondRequest?.prompt).not.toContain("first");
  });

  it("a known conversation_id used with another model is refused", async () => {
    const { service } = buildService();
    const first = await service.complete(buildRequest());
    const pending = service.complete(buildRequest({ model: "gemini-4-argon", conversation_id: first.body.conversation_id }));
    const error = await captureError(pending);

    expect(error).toMatchObject({ param: "conversation_id" });
  });
});

describe("ChatCompletionService structured output", () => {
  it("returns the structured output as the message content", async () => {
    const { service } = buildService(buildStructuredResult);
    const outcome = await service.complete(buildRequest({ response_format: SCHEMA_FORMAT }));

    expect(outcome.body.choices[0]?.message.content).toBe("{\"answer\":\"ok\"}");
  });

  it("AC4: an agy success without structured_output fails with agy_failed", async () => {
    const { service } = buildService();
    const pending = service.complete(buildRequest({ response_format: SCHEMA_FORMAT }));
    const error = await captureError(pending);

    expect(error).toMatchObject({ code: "agy_failed" });
  });
});
