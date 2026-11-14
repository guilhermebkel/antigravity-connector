export type CutReport = {
  text: string;
  isTruncated: boolean;
};

export class ReportUtil {
  static readonly MAX_CHARS = 20000;

  static readonly PARAGRAPH_BREAK = "\n\n";

  static truncate(report: string): CutReport {
    if (report.length <= ReportUtil.MAX_CHARS) {
      return { text: report, isTruncated: false };
    }
    const head = report.slice(0, ReportUtil.MAX_CHARS);
    const paragraphEnd = head.lastIndexOf(ReportUtil.PARAGRAPH_BREAK);
    const text = paragraphEnd > 0 ? head.slice(0, paragraphEnd) : head;
    return { text: text.trimEnd(), isTruncated: true };
  }
}
