import { describe, expect, it } from "vitest";
import { FixtureUtil } from "@antigravity-connector/protocol/Testing/FixtureUtil.ts";
import { AgyEnvelopeSchema } from "@antigravity-connector/protocol/Schemas/AgyEnvelopeSchema.ts";

const VALID_ENVELOPE = {
  conversation_id: "00000000-0000-4000-8000-000000000000",
  status: "SUCCESS",
  response: "pong\n",
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    thinking_tokens: 3,
    cache_read_tokens: 2,
    total_tokens: 18,
  },
};

describe("AgyEnvelopeSchema", () => {
  it.each(["chatEnvelope.json", "searchEnvelope.json", "imageEnvelope.json", "errorEnvelope.json"])(
    "parses the recorded fixture %s",
    (fileName) => {
      const result = AgyEnvelopeSchema.safeParse(FixtureUtil.readJson(fileName));

      expect(result.success).toBe(true);
    },
  );

  it("reads the status of the recorded error envelope as ERROR", () => {
    const result = AgyEnvelopeSchema.safeParse(FixtureUtil.readJson("errorEnvelope.json"));

    expect(result.data?.status).toBe("ERROR");
  });

  it("keeps an extra key it does not know", () => {
    const result = AgyEnvelopeSchema.safeParse({ ...VALID_ENVELOPE, new_field_from_cli: "kept" });

    expect(result.data).toStrictEqual({ ...VALID_ENVELOPE, new_field_from_cli: "kept" });
  });

  it("maps a status it does not know to unknown instead of failing", () => {
    const result = AgyEnvelopeSchema.safeParse({ ...VALID_ENVELOPE, status: "QUEUED" });

    expect(result.data?.status).toBe("unknown");
  });

  it("names the key when status is missing", () => {
    const { status: _status, ...withoutStatus } = VALID_ENVELOPE;
    const result = AgyEnvelopeSchema.safeParse(withoutStatus);

    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["status"]]);
  });

  it("names the key when response is missing", () => {
    const { response: _response, ...withoutResponse } = VALID_ENVELOPE;
    const result = AgyEnvelopeSchema.safeParse(withoutResponse);

    expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([["response"]]);
  });
});
