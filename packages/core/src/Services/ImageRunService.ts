import { AgyOutputError, AgyTimeoutError } from "@antigravity-connector/agy";
import type { RunDoor } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { RunObserver } from "@antigravity-connector/core/Protocols/RunProgressProtocol.ts";
import type { RunAttachment } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import { ImageNotProducedError } from "@antigravity-connector/core/Errors/ImageNotProducedError.ts";
import { ImageTimeoutError } from "@antigravity-connector/core/Errors/ImageTimeoutError.ts";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import { ImageOutputUtil } from "@antigravity-connector/core/Utils/ImageOutputUtil.ts";

export type ImageRunInput = {
  door: RunDoor;
  model: string;
  prompt: string;
  attachments?: readonly RunAttachment[];
};

export type ImageRunOutcome = {
  bytes: Uint8Array;
  model: string;
  durationMs: number;
  totalTokens: number;
};

export type ImageRunServiceOptions = { runService: AgyRunService };

export class ImageRunService {
  static readonly OUTPUT_FILE_NAME = "output.png";

  static readonly MS_PER_SECOND = 1000;

  private readonly runService: AgyRunService;

  constructor(options: ImageRunServiceOptions) {
    this.runService = options.runService;
  }

  async generate(input: ImageRunInput, signal?: AbortSignal, observer?: RunObserver): Promise<ImageRunOutcome> {
    const result = await this.runImage(input, signal, observer);
    const bytes = result.outputFiles[ImageRunService.OUTPUT_FILE_NAME];
    if (bytes === undefined) {
      throw new ImageNotProducedError(this.runService.buildAnswerExcerpt(result.envelope.response));
    }
    ImageOutputUtil.assertPng(bytes);
    return {
      bytes,
      model: input.model,
      durationMs: Math.round((result.envelope.duration_seconds ?? 0) * ImageRunService.MS_PER_SECOND),
      totalTokens: result.envelope.usage.total_tokens,
    };
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
