export type CheckUsageInput = { readonly noArguments?: never };

export type UsageLimit = {
  name: string;
  window: "five_hour" | "weekly" | "other";
  remainingPercent: number;
  resetsAt?: string;
};

export type UsageGroup = {
  name: string;
  limits: UsageLimit[];
};

export type CheckUsageOutput = {
  checkedAt: string;
  groups: UsageGroup[];
};
