import type { ModelId } from "@antigravity-connector/protocol/Protocols/ModelIdProtocol.ts";

export class ModelInfoUtil {
  // Why: these describe what the models are for, from agy's own names and changelog and from our runs; the tiers are agy's roles, not benchmarks.
  static readonly MODEL_ID_TO_DESCRIPTION: Readonly<Record<ModelId, string>> = {
    "gemini-3.8-flash": "Default and best value for most calls: short questions, search, transcription and simple reads. Its weak spot is sound in video, so pick another model when the sound matters. Makes pictures.",
    "gemini-4-argon": "Pro tier, for analysis and harder questions where accuracy matters more than speed. Overkill for simple questions. Makes pictures.",
    "gemini-4-carbon": "Planner tier, for tasks that benefit from a plan first. For direct answers it is a poor fit, because it tends to write a plan instead of answering. Makes pictures.",
    "gemini-4-hydrogen": "Executor tier and the best value for most tasks: quick and accurate on text, audio and video. Good default when you do not need Flash. Makes pictures.",
    "gemini-4-neon": "Newest Gemini 4 model, for video and when you want the latest model. Slower than Hydrogen on audio. Makes pictures.",
  };

  static buildFieldDescription(hint: string): string {
    const options = Object.entries(ModelInfoUtil.MODEL_ID_TO_DESCRIPTION)
      .map(([id, description]) => `${id}: ${description}`)
      .join(" ");
    return `${hint} Models: ${options}`;
  }
}
