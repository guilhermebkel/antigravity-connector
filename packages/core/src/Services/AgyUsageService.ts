import { AgySessionRequiredError, type AgyUsagePort, type AgyUsageReport } from "@antigravity-connector/agy";
import type { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";

export type AgyUsageServiceOptions = {
  port: AgyUsagePort;
  session: AgySessionService;
  clock: () => number;
};

export type AgyUsageSnapshot = {
  report: AgyUsageReport;
  checkedAtMs: number;
};

export class AgyUsageService {
  // Why: agy reads its quota from Google on each call; a short cache keeps a client that polls from spawning a process each time.
  static readonly CACHE_MS = 30000;

  private readonly port: AgyUsagePort;

  private readonly session: AgySessionService;

  private readonly clock: () => number;

  private cached: AgyUsageSnapshot | undefined = undefined;

  private pending: Promise<AgyUsageSnapshot> | undefined = undefined;

  constructor(options: AgyUsageServiceOptions) {
    this.port = options.port;
    this.session = options.session;
    this.clock = options.clock;
  }

  async read(): Promise<AgyUsageSnapshot> {
    const cached = this.cached;
    if (cached !== undefined && this.clock() - cached.checkedAtMs < AgyUsageService.CACHE_MS) {
      return cached;
    }
    this.pending ??= this.fetch().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async fetch(): Promise<AgyUsageSnapshot> {
    await this.session.ensureConnected();
    try {
      const report = await this.port.read();
      const snapshot: AgyUsageSnapshot = { report, checkedAtMs: this.clock() };
      this.cached = snapshot;
      return snapshot;
    } catch (error: unknown) {
      if (error instanceof AgySessionRequiredError) {
        this.session.reportSessionRequired(error.loginUrl);
      }
      throw error;
    }
  }
}
