export class AgyStdinMessageUtil {
  static readonly USER_EVENT = "user";

  static buildUserLine(prompt: string): string {
    return `${JSON.stringify({ event: AgyStdinMessageUtil.USER_EVENT, message: { content: prompt } })}\n`;
  }
}
