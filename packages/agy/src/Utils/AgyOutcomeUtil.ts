import { AgyEnvelopeSchema, RedactUtil } from "@antigravity-connector/protocol";
import type { AgyEnvelope } from "@antigravity-connector/protocol";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgySessionRequiredError } from "@antigravity-connector/agy/Errors/AgySessionRequiredError.ts";
import { AgyTimeoutError } from "@antigravity-connector/agy/Errors/AgyTimeoutError.ts";
import type { AgyProcessOutcome } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export class AgyOutcomeUtil {
  static readonly SESSION_REQUIRED_TEXT = "Authentication required";

  static readonly LOGIN_URL_PATTERN = /https:\/\/accounts\.google\.com\/o\/oauth2\/\S+/;

  static readEnvelope(outcome: AgyProcessOutcome, timeoutMs: number, secrets: readonly string[]): AgyEnvelope {
    const excerpt = RedactUtil.buildExcerpt(outcome.stderr, secrets);
    if (outcome.isTimedOut) {
      throw new AgyTimeoutError(timeoutMs, excerpt);
    }
    const combinedOutput = `${outcome.stdout}\n${outcome.stderr}`;
    if (combinedOutput.includes(AgyOutcomeUtil.SESSION_REQUIRED_TEXT)) {
      throw new AgySessionRequiredError(AgyOutcomeUtil.extractLoginUrl(combinedOutput));
    }
    if (outcome.exitCode !== 0) {
      throw new AgyFailedError(outcome.exitCode, excerpt);
    }
    const envelope = AgyOutcomeUtil.parseEnvelope(outcome.stdout);
    if (envelope.status !== "SUCCESS") {
      throw new AgyFailedError(outcome.exitCode, excerpt);
    }
    return envelope;
  }

  static extractLoginUrl(text: string): string | undefined {
    const match = AgyOutcomeUtil.LOGIN_URL_PATTERN.exec(text);
    return match?.[0];
  }

  static parseEnvelope(stdout: string): AgyEnvelope {
    const json = AgyOutcomeUtil.decodeJson(stdout);
    const result = AgyEnvelopeSchema.safeParse(json);
    if (!result.success) {
      const firstPath = result.error.issues[0]?.path.join(".") ?? "";
      throw new AgyOutputError(`the envelope does not match the schema at ${firstPath}`);
    }
    return result.data;
  }

  static decodeJson(stdout: string): unknown {
    try {
      return JSON.parse(stdout.trim());
    } catch {
      throw new AgyOutputError("stdout is not one JSON object");
    }
  }
}
