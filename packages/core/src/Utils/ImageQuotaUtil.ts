export class ImageQuotaUtil {
  static readonly MS_PER_SECOND = 1000;

  static readonly MS_PER_MINUTE = 60000;

  static readonly MS_PER_HOUR = 3600000;

  // Why: agy writes the reset time of the quota in its answer, as "resets after 4h28m46s" or "reset in 52m35s".
  static readonly RESET_PATTERN = /resets?\s+(?:will\s+)?(?:after|in)\s+(\S+)/i;

  static readonly HOUR_PATTERN = /(\d{1,9}(?:\.\d{1,9})?)h/;

  static readonly MINUTE_PATTERN = /(\d{1,9}(?:\.\d{1,9})?)m/;

  static readonly SECOND_PATTERN = /(\d{1,9}(?:\.\d{1,9})?)s/;

  static readResetMs(answer: string): number | undefined {
    const duration = ImageQuotaUtil.RESET_PATTERN.exec(answer)?.[1] ?? "";
    const hours = ImageQuotaUtil.readPart(duration, ImageQuotaUtil.HOUR_PATTERN, ImageQuotaUtil.MS_PER_HOUR);
    const minutes = ImageQuotaUtil.readPart(duration, ImageQuotaUtil.MINUTE_PATTERN, ImageQuotaUtil.MS_PER_MINUTE);
    const seconds = ImageQuotaUtil.readPart(duration, ImageQuotaUtil.SECOND_PATTERN, ImageQuotaUtil.MS_PER_SECOND);
    // Why: a time with no unit ("in 2 hours") gives no usable reset time, so the caller uses its fallback.
    if (hours === undefined && minutes === undefined && seconds === undefined) {
      return undefined;
    }
    return (hours ?? 0) + (minutes ?? 0) + (seconds ?? 0);
  }

  static readPart(duration: string, pattern: RegExp, msPerUnit: number): number | undefined {
    const value = Number(pattern.exec(duration)?.[1]);
    return Number.isNaN(value) ? undefined : value * msPerUnit;
  }
}
