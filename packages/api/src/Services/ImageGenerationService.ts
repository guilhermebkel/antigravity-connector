import type { ImageRunInput, ImageRunService } from "@antigravity-connector/core";
import { ImageNotProducedError } from "@antigravity-connector/core";
import type { ImageGenerationRequest, ImageGenerationResponse } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";

export type ImageGenerationOutcome = {
  body: ImageGenerationResponse;
  ignoredParams: readonly string[];
};

export type ImageGenerationServiceOptions = {
  imageService: ImageRunService;
  clock: () => number;
};

export class ImageGenerationService {
  static readonly DOOR = "api";

  static readonly SOURCE = "/v1/images/generations";

  static readonly DEFAULT_MODEL = "gemini-3.8-flash";

  static readonly ONLY_SUPPORTED_RESPONSE_FORMAT = "b64_json";

  static readonly IGNORED_PARAM_NAMES: readonly (keyof ImageGenerationRequest)[] = ["size", "quality", "style"];

  static readonly MS_PER_SECOND = 1000;

  private readonly imageService: ImageRunService;

  private readonly clock: () => number;

  constructor(options: ImageGenerationServiceOptions) {
    this.imageService = options.imageService;
    this.clock = options.clock;
  }

  async generate(request: ImageGenerationRequest, signal?: AbortSignal): Promise<ImageGenerationOutcome> {
    ImageGenerationService.checkRequest(request);
    const ignoredParams = ImageGenerationService.IGNORED_PARAM_NAMES.filter((name) => request[name] !== undefined);
    const input: ImageRunInput = {
      door: ImageGenerationService.DOOR,
      model: request.model ?? ImageGenerationService.DEFAULT_MODEL,
      prompt: request.prompt,
    };
    const bytes = await this.readBytes(input, signal);
    const created = Math.floor(this.clock() / ImageGenerationService.MS_PER_SECOND);
    return {
      body: { created, data: [{ b64_json: Buffer.from(bytes).toString("base64") }] },
      ignoredParams,
    };
  }

  static checkRequest(request: ImageGenerationRequest): void {
    if (request.n !== undefined && request.n !== 1) {
      throw new ApiRequestError("invalid_request_error", "n", "n must be 1: this server creates one image per request.");
    }
    const format = request.response_format;
    if (format !== undefined && format !== ImageGenerationService.ONLY_SUPPORTED_RESPONSE_FORMAT) {
      throw new ApiRequestError("invalid_request_error", "response_format", "Only response_format b64_json is supported.");
    }
  }

  private async readBytes(input: ImageRunInput, signal: AbortSignal | undefined): Promise<Uint8Array> {
    try {
      const outcome = await this.imageService.generate(input, signal);
      return outcome.bytes;
    } catch (error: unknown) {
      if (error instanceof ImageNotProducedError) {
        throw new ApiRequestError("agy_failed", null, "agy finished without a PNG file.");
      }
      throw error;
    }
  }
}
