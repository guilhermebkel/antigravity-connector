import type { ModelId } from "@antigravity-connector/protocol/Protocols/ModelIdProtocol.ts";

export class ModelInfoUtil {
  // Why: these describe what the models are for, from agy's own names and changelog and from our runs; the tiers are agy's roles, not benchmarks.
  static readonly MODEL_ID_TO_DESCRIPTION: Readonly<Record<ModelId, string>> = {
    "gemini-3.8-flash": "Flash tier, the default. About 2 s for a short text answer in our tests; a picture in about 40 s. Use it unless a call needs more reasoning.",
    "gemini-4-argon": "Pro tier: agy's pro model. Use it for longer analysis or harder questions; slower than Flash. A picture in about 50 s in our tests.",
    "gemini-4-carbon": "Planner tier: agy's orchestrator uses it to plan a task before another model carries it out. Use it for research that needs a plan. A picture in about 40 s in our tests.",
    "gemini-4-hydrogen": "Executor tier: agy's orchestrator uses it to carry out a plan. The quickest picture in our runs (about 30 s).",
    "gemini-4-neon": "Newest Gemini 4 model, with its own orchestrator. The only model we tested on video (a 4 s clip in about 14 s). A picture in about 45 s.",
  };

  static buildFieldDescription(hint: string): string {
    const options = Object.entries(ModelInfoUtil.MODEL_ID_TO_DESCRIPTION)
      .map(([id, description]) => `${id}: ${description}`)
      .join(" ");
    return `${hint} Models: ${options}`;
  }
}
