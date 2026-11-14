import { describe, expect, it } from "vitest";
import type { ChatCompletionRequest } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";
import { ChatSchemaUtil } from "@antigravity-connector/api/Utils/ChatSchemaUtil.ts";

const buildRequest = (responseFormat: ChatCompletionRequest["response_format"]): ChatCompletionRequest => ({
  model: "gemini-3.8-flash",
  messages: [{ role: "user", content: "hi" }],
  response_format: responseFormat,
});

describe("ChatSchemaUtil.readResponseSchema", () => {
  it("has no schema for a text response", () => {
    const request = buildRequest({ type: "text" });
    expect(ChatSchemaUtil.readResponseSchema(request)).toBeUndefined();
  });

  it("uses a permissive object schema for json_object", () => {
    const request = buildRequest({ type: "json_object" });
    const schemaText = ChatSchemaUtil.readResponseSchema(request);
    expect(schemaText).toBe("{\"type\":\"object\"}");
  });

  it("passes the json_schema object as JSON text", () => {
    const schema = { type: "object", properties: { answer: { type: "string" } } };

    const request = buildRequest({ type: "json_schema", json_schema: { name: "x", schema } });
    expect(ChatSchemaUtil.readResponseSchema(request)).toBe(JSON.stringify(schema));
  });

  it("AC3: a schema that is not an object is refused with a 400 naming response_format", () => {
    const request = buildRequest({ type: "json_schema", json_schema: { name: "x", schema: "nope" } });

    expect(() => ChatSchemaUtil.readResponseSchema(request)).toThrow(ApiRequestError);
    expect(() => ChatSchemaUtil.readResponseSchema(request)).toThrow(/response_format/);
  });

  it("refuses a schema larger than 64 KB", () => {
    const schema = { description: "x".repeat(ChatSchemaUtil.MAX_SCHEMA_BYTES) };
    const request = buildRequest({ type: "json_schema", json_schema: { name: "x", schema } });

    expect(() => ChatSchemaUtil.readResponseSchema(request)).toThrow(/64 KB/);
  });
});
