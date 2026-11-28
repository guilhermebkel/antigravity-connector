import type { ModelId } from "@antigravity-connector/protocol/Protocols/ModelIdProtocol.ts";

export class ModelInfoUtil {
  // Why: these describe what the models are for, from agy's own names and changelog and from our runs; the tiers are agy's roles, not benchmarks.
  static readonly MODEL_ID_TO_DESCRIPTION: Readonly<Record<ModelId, string>> = {
    "gemini-3.8-flash": "Flash tier, the default. Quick and correct on short questions, arithmetic and transcription (1.8 to 5 s in our runs). For video it may try a shell command that plan mode denies, and then answers nothing. A picture in about 40 s.",
    "gemini-4-argon": "Pro tier: agy's pro model. Correct on every test, but slow on arithmetic (about 22 s). Use it when accuracy matters more than speed. A picture in about 50 s.",
    "gemini-4-carbon": "Planner tier. In plan mode it answers with a plan for approval instead of an answer, so do not use it for direct answers or reports here. It did transcribe and analyse video correctly. A picture in about 40 s.",
    "gemini-4-hydrogen": "Executor tier: agy's orchestrator uses it to carry out a plan. Correct on every test and the fastest in our runs (1.7 to 5.2 s on text, audio and video). A picture in about 30 s, the quickest we measured.",
    "gemini-4-neon": "Newest Gemini 4 model. Correct on every test; the slowest at transcription (about 16 s) and good on video (about 8 s). A picture in about 45 s.",
  };

  static buildFieldDescription(hint: string): string {
    const options = Object.entries(ModelInfoUtil.MODEL_ID_TO_DESCRIPTION)
      .map(([id, description]) => `${id}: ${description}`)
      .join(" ");
    return `${hint} Models: ${options}`;
  }
}
