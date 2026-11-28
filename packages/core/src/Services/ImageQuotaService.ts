import { ImageQuotaError } from "@antigravity-connector/core/Errors/ImageQuotaError.ts";

export type ImageQuotaServiceOptions = { clock: () => number };

export class ImageQuotaService {
  static readonly MS_PER_MINUTE = 60000;

  static readonly FALLBACK_COOLDOWN_MS = 3600000;

  static readonly MAX_COOLDOWN_MS = 86400000;

  private readonly clock: () => number;

  private blockedUntilMs: number | undefined = undefined;

  constructor(options: ImageQuotaServiceOptions) {
    this.clock = options.clock;
  }

  assertAvailable(): void {
    const until = this.blockedUntilMs;
    const now = this.clock();
    // Why: this runs before the agy run and before the daily limit, so a refused call spends neither.
    if (until === undefined || now >= until) {
      return;
    }
    const minutesLeft = Math.ceil((until - now) / ImageQuotaService.MS_PER_MINUTE);
    throw new ImageQuotaError(new Date(until).toISOString(), minutesLeft);
  }

  recordExhausted(resetMs: number | undefined): void {
    // Why: a reset time over a day means the answer was not read right; the cap keeps a wrong time from blocking images for longer.
    const cooldownMs = resetMs === undefined
      ? ImageQuotaService.FALLBACK_COOLDOWN_MS
      : Math.min(Math.max(resetMs, 0), ImageQuotaService.MAX_COOLDOWN_MS);
    this.blockedUntilMs = this.clock() + cooldownMs;
  }
}
