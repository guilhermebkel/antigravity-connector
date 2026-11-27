export type AgyUsageWindow = "five_hour" | "weekly" | "other";

export type AgyUsageBucket = {
  group: string;
  name: string;
  window: AgyUsageWindow;
  remainingPercent: number;
  resetsAt?: string;
};

export type AgyUsageReport = { buckets: AgyUsageBucket[] };

export interface AgyUsagePort { read(): Promise<AgyUsageReport> }
