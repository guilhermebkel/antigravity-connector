import type {
  AgyUsageBucket,
  AgyUsageReport,
  AgyUsageWindow,
} from "@antigravity-connector/agy/Protocols/AgyUsageProtocol.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";

const FIELD_COUNT = 4;
const PERCENT_PATTERN = /^(\d{1,3})%$/;
const MAX_PERCENT = 100;
const UNUSED_RESET_PREFIX = "1970-";

type UsageLimitName = "Five Hour Limit Remaining" | "Weekly Limit Remaining";

export class AgyUsageParseUtil {
  static readonly FIELD_SEPARATOR = "\t";

  static readonly NAME_TO_WINDOW: Readonly<Partial<Record<UsageLimitName, AgyUsageWindow>>> = {
    "Five Hour Limit Remaining": "five_hour",
    "Weekly Limit Remaining": "weekly",
  };

  static parse(response: string): AgyUsageReport {
    const buckets = response
      .split("\n")
      .map((line) => AgyUsageParseUtil.parseLine(line))
      .filter((bucket): bucket is AgyUsageBucket => bucket !== undefined);
    if (buckets.length === 0) {
      throw new AgyOutputError("the usage answer has no limits");
    }
    return { buckets };
  }

  static parseLine(line: string): AgyUsageBucket | undefined {
    const fields = line.split(AgyUsageParseUtil.FIELD_SEPARATOR);
    if (fields.length !== FIELD_COUNT) {
      return undefined;
    }
    const [group = "", name = "", percentText = "", reset = ""] = fields;
    const percent = Number(PERCENT_PATTERN.exec(percentText)?.[1]);
    if (Number.isNaN(percent) || percent > MAX_PERCENT) {
      return undefined;
    }
    const window = AgyUsageParseUtil.NAME_TO_WINDOW[name as UsageLimitName] ?? "other";
    const bucket: AgyUsageBucket = { group, name, window, remainingPercent: percent };
    // Why: a group that was never used reports the epoch as its reset time; that is "no window started", not a date.
    return reset === "" || reset.startsWith(UNUSED_RESET_PREFIX) ? bucket : { ...bucket, resetsAt: reset };
  }
}
