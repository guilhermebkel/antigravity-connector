import type { AgyRunnerPort } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import type { AgyUsagePort, AgyUsageReport } from "@antigravity-connector/agy/Protocols/AgyUsageProtocol.ts";
import { AgyUsageParseUtil } from "@antigravity-connector/agy/Utils/AgyUsageParseUtil.ts";

export type AgyUsageAdapterOptions = {
  runner: AgyRunnerPort;
  modelSlug: string;
  timeoutMs: number;
};

export class AgyUsageAdapter implements AgyUsagePort {
  // Why: agy answers its own slash command in print mode with no model call, so this read spends no quota.
  static readonly USAGE_COMMAND = "/usage";

  private readonly runner: AgyRunnerPort;

  private readonly modelSlug: string;

  private readonly timeoutMs: number;

  constructor(options: AgyUsageAdapterOptions) {
    this.runner = options.runner;
    this.modelSlug = options.modelSlug;
    this.timeoutMs = options.timeoutMs;
  }

  async read(): Promise<AgyUsageReport> {
    const result = await this.runner.run({
      prompt: AgyUsageAdapter.USAGE_COMMAND,
      modelSlug: this.modelSlug,
      profile: {
        isPlanMode: true,
        shouldSkipPermissions: false,
        timeoutMs: this.timeoutMs,
        expectedOutputFileNames: [],
      },
    });
    return AgyUsageParseUtil.parse(result.envelope.response);
  }
}
