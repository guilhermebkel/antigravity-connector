import type { RunKind } from "@antigravity-connector/protocol";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";

export type DailyLimitOptions = {
  runKindToLimit: Readonly<Record<RunKind, number>>;
  clock: () => Date;
};

export class DailyLimitService {
  static readonly ISO_DAY_LENGTH = 10;

  private readonly runKindToLimit: Readonly<Record<RunKind, number>>;

  private readonly clock: () => Date;

  private currentDay = "";

  private runKindToCount: Partial<Record<RunKind, number>> = {};

  constructor(options: DailyLimitOptions) {
    this.runKindToLimit = options.runKindToLimit;
    this.clock = options.clock;
  }

  consume(runKind: RunKind): void {
    const now = this.clock();
    const day = now.toISOString().slice(0, DailyLimitService.ISO_DAY_LENGTH);
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.runKindToCount = {};
    }
    const count = this.runKindToCount[runKind] ?? 0;
    const limit = this.runKindToLimit[runKind];
    if (count >= limit) {
      throw new DailyLimitError(runKind, limit, DailyLimitService.resolveNextMidnightUtc(now));
    }
    this.runKindToCount[runKind] = count + 1;
  }

  seed(runKindToCount: Partial<Record<RunKind, number>>): void {
    const day = this.clock().toISOString().slice(0, DailyLimitService.ISO_DAY_LENGTH);
    this.currentDay = day;
    this.runKindToCount = { ...runKindToCount };
  }

  static resolveNextMidnightUtc(now: Date): string {
    const nextDay = now.getUTCDate() + 1;
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), nextDay);
    return new Date(midnight).toISOString();
  }
}
