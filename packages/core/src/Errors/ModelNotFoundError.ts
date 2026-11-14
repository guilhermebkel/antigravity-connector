import type { OpenAiErrorCode } from "@antigravity-connector/protocol";

export class ModelNotFoundError extends Error {
  readonly code: OpenAiErrorCode = "model_not_found";

  constructor(modelId: string) {
    super(`The model ${modelId} does not exist`);
    this.name = "ModelNotFoundError";
  }
}
