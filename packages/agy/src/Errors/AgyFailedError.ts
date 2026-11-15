import type { AgyStatus, OpenAiErrorCode } from "@antigravity-connector/protocol";

export type AgyFailureEnvelope = {
  status: AgyStatus;
  error: string | undefined;
};

export class AgyFailedError extends Error {
  readonly code: OpenAiErrorCode = "agy_failed";

  readonly exitCode: number | null;

  readonly stderrExcerpt: string;

  readonly envelopeStatus: AgyStatus | undefined;

  readonly envelopeError: string | undefined;

  constructor(exitCode: number | null, stderrExcerpt: string, envelope?: AgyFailureEnvelope) {
    super(`agy failed with exit code ${exitCode ?? "none"}: ${stderrExcerpt}`);
    this.name = "AgyFailedError";
    this.exitCode = exitCode;
    this.stderrExcerpt = stderrExcerpt;
    this.envelopeStatus = envelope?.status;
    this.envelopeError = envelope?.error;
  }
}
