import type { WebSearchSource } from "@antigravity-connector/mcp/Protocols/WebSearchProtocol.ts";

export class SourceUtil {
  static readonly URL_PATTERN = /https?:\/\/[^\s<>"'()[\]]+/g;

  static readonly TRAILING_CHARACTER_PATTERN = /^[.,;:!?]$/;

  static extract(answer: string): WebSearchSource[] {
    const urls = new Set<string>();
    for (const match of answer.matchAll(SourceUtil.URL_PATTERN)) {
      urls.add(SourceUtil.trimUrl(match[0]));
    }
    return [...urls].map((url) => ({ title: SourceUtil.readHostname(url), url }));
  }

  static trimUrl(url: string): string {
    let end = url.length;
    while (end > 0 && SourceUtil.TRAILING_CHARACTER_PATTERN.test(url.charAt(end - 1))) {
      end -= 1;
    }
    return url.slice(0, end);
  }

  static readHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}
