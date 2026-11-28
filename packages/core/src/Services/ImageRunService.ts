import { AgyOutputError, AgyTimeoutError } from "@antigravity-connector/agy";
import type { RunDoor } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { RunObserver } from "@antigravity-connector/core/Protocols/RunProgressProtocol.ts";
import type { RunAttachment } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import { ImageNotProducedError } from "@antigravity-connector/core/Errors/ImageNotProducedError.ts";
import { ImageTimeoutError } from "@antigravity-connector/core/Errors/ImageTimeoutError.ts";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { ImageOutputUtil, type ImageOutputMime } from "@antigravity-connector/core/Utils/ImageOutputUtil.ts";
import { ImageQuotaService } from "@antigravity-connector/core/Services/ImageQuotaService.ts";
import { AnswerKindUtil } from "@antigravity-connector/core/Utils/AnswerKindUtil.ts";
import { ImageQuotaUtil } from "@antigravity-connector/core/Utils/ImageQuotaUtil.ts";

export type ImageRunInput = {
  door: RunDoor;
  model: string;
  prompt: string;
  attachments?: readonly RunAttachment[];
};

export type ImageRunOutcome = {
  bytes: Uint8Array;
  mimeType: ImageOutputMime;
  model: string;
  durationMs: number;
  totalTokens: number;
};

export type ImageRunServiceOptions = {
  runService: AgyRunService;
  quota: ImageQuotaService;
};

export class ImageRunService {
  static readonly OUTPUT_FILE_NAME = "output.png";

  static readonly MS_PER_SECOND = 1000;

  private readonly runService: AgyRunService;

  private readonly quota: ImageQuotaService;

  constructor(options: ImageRunServiceOptions) {
    this.runService = options.runService;
    this.quota = options.quota;
  }

  async generate(input: ImageRunInput, signal?: AbortSignal, observer?: RunObserver): Promise<ImageRunOutcome> {
    this.quota.assertAvailable();
    const result = await this.runImage(input, signal, observer);
    const bytes = ImageOutputUtil.findImage(result.outputFiles);
    if (bytes === undefined) {
      this.recordQuotaAnswer(result.envelope.response);
      throw new ImageNotProducedError(this.runService.buildAnswerExcerpt(result.envelope.response));
    }
    const mimeType = ImageOutputUtil.assertImage(bytes);
    return {
      bytes,
      mimeType,
      model: input.model,
      durationMs: Math.round((result.envelope.duration_seconds ?? 0) * ImageRunService.MS_PER_SECOND),
      totalTokens: result.envelope.usage.total_tokens,
    };
  }

  private recordQuotaAnswer(answer: string): void {
    if (AnswerKindUtil.classify(answer) !== "quota") {
      return;
    }
    // Why: a quota answer starts the cooldown, so the next calls are refused here instead of running agy again.
    this.quota.recordExhausted(ImageQuotaUtil.readResetMs(answer));
    this.quota.assertAvailable();
  }

  private async runImage(input: ImageRunInput, signal: AbortSignal | undefined, observer: RunObserver | undefined) {
    try {
      const messages = [{ role: "user" as const, content: input.prompt }];
      const attachments = input.attachments ?? [];
      return await this.runService.run("image", { door: input.door, model: input.model, messages, attachments }, signal, observer);
    } catch (error: unknown) {
      if (error instanceof AgyOutputError) {
        throw new ImageNotProducedError();
      }
      if (error instanceof AgyTimeoutError) {
        throw new ImageTimeoutError(error.lastActivity);
      }
      throw error;
    }
  }
}
