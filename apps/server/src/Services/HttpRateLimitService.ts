export type RateBucket = "authenticated" | "failed";

export type HttpRateLimitOptions = {
  maxRequestsPerWindow: number;
  clock: () => number;
};

export class HttpRateLimitService {
  static readonly WINDOW_MS = 60000;

  private readonly maxRequestsPerWindow: number;

  private readonly clock: () => number;

  private windowStartAtMs = 0;

  private bucketToCount: Partial<Record<RateBucket, number>> = {};

  constructor(options: HttpRateLimitOptions) {
    this.maxRequestsPerWindow = options.maxRequestsPerWindow;
    this.clock = options.clock;
  }

  consume(bucket: RateBucket): boolean {
    this.resetWhenWindowEnded();
    const count = this.bucketToCount[bucket] ?? 0;
    if (count >= this.maxRequestsPerWindow) {
      return false;
    }
    this.bucketToCount[bucket] = count + 1;
    return true;
  }

  private resetWhenWindowEnded(): void {
    const now = this.clock();
    if (now - this.windowStartAtMs < HttpRateLimitService.WINDOW_MS) {
      return;
    }
    this.windowStartAtMs = now;
    this.bucketToCount = {};
  }
}
