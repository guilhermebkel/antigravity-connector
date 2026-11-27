import type { RunDoor } from "@antigravity-connector/core/Protocols/RunProtocol.ts";
import type { RunObserver } from "@antigravity-connector/core/Protocols/RunProgressProtocol.ts";
import { ImageUploadError } from "@antigravity-connector/core/Errors/ImageUploadError.ts";
import { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import type { ImageUploadService } from "@antigravity-connector/core/Services/ImageUploadService.ts";
import { UploadReferenceUtil } from "@antigravity-connector/core/Utils/UploadReferenceUtil.ts";

export type MediaRunInput = {
  door: RunDoor;
  kind: "audio" | "video";
  model: string;
  file: string;
  prompt: string;
  source: string;
};

export type MediaRunOutcome = {
  text: string;
  model: string;
  durationMs: number;
  totalTokens: number;
};

export type MediaRunServiceOptions = {
  runService: AgyRunService;
  uploads: ImageUploadService;
};

export class MediaRunService {
  static readonly MS_PER_SECOND = 1000;

  private readonly runService: AgyRunService;

  private readonly uploads: ImageUploadService;

  constructor(options: MediaRunServiceOptions) {
    this.runService = options.runService;
    this.uploads = options.uploads;
  }

  async run(input: MediaRunInput, signal?: AbortSignal, observer?: RunObserver): Promise<MediaRunOutcome> {
    const uploadId = UploadReferenceUtil.readImageId(input.file);
    if (uploadId === undefined) {
      throw new ImageUploadError("image_not_found");
    }
    // Why: the file is checked before the queue and the daily limit, so a wrong or expired upload spends no run.
    const media = this.uploads.readMedia(uploadId, input.kind);
    const attachments = [{ fileName: `attachment-1.${media.extension}`, bytes: media.bytes }];
    const messages = [{ role: "user" as const, content: input.prompt }];
    const result = await this.runService.run(
      "media",
      { messages, attachments, door: input.door, model: input.model, source: input.source },
      signal,
      observer,
    );
    return {
      text: result.envelope.response,
      model: input.model,
      durationMs: Math.round((result.envelope.duration_seconds ?? 0) * MediaRunService.MS_PER_SECOND),
      totalTokens: result.envelope.usage.total_tokens,
    };
  }
}
