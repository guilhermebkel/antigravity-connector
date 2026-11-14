import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class McpErrorUtil {
  static readonly UNKNOWN_TEXT
    = "The call did not run because of an unexpected error. What to do: check the container logs, then retry.";

  static readonly CODE_TO_TEXT: Readonly<Partial<Record<OpenAiErrorCode, string>>> = {
    agy_session_required: "The call did not run: agy is not logged in. What to do: check the container logs for the login block, log in with docker exec, then retry.",
    queue_timeout: "The call did not run: it waited too long in the agy queue. What to do: retry in a moment.",
    agy_timeout: "The call was stopped: agy did not finish in time. What to do: retry with a narrower query.",
    agy_failed: "The call failed: agy could not answer. What to do: check the container logs, then retry.",
    image_not_produced: "The call did not produce an image: agy finished without a PNG file. What to do: retry, or describe the picture in more detail.",
    image_invalid: "The call did not return an image: agy wrote a file that is not a PNG of the allowed size. What to do: retry with a simpler prompt.",
  };

  static readonly CODES_WITH_OWN_MESSAGE: ReadonlySet<OpenAiErrorCode> = new Set<OpenAiErrorCode>([
    "daily_limit_reached",
    "model_not_found",
  ]);

  static describe(error: unknown): string {
    const code = McpErrorUtil.readCode(error);
    if (code === undefined) {
      return McpErrorUtil.UNKNOWN_TEXT;
    }
    if (McpErrorUtil.CODES_WITH_OWN_MESSAGE.has(code) && error instanceof Error) {
      return `The call did not run: ${error.message}. What to do: use the answer you already have, or wait for the reset.`;
    }
    return McpErrorUtil.CODE_TO_TEXT[code] ?? McpErrorUtil.UNKNOWN_TEXT;
  }

  static readCode(error: unknown): OpenAiErrorCode | undefined {
    if (!(error instanceof Error) || !("code" in error) || typeof error.code !== "string") {
      return undefined;
    }
    return McpErrorUtil.isKnownCode(error.code) ? error.code : undefined;
  }

  static isKnownCode(code: string): code is OpenAiErrorCode {
    const hasText = Object.hasOwn(McpErrorUtil.CODE_TO_TEXT, code);
    return hasText || McpErrorUtil.CODES_WITH_OWN_MESSAGE.has(code as OpenAiErrorCode);
  }
}
