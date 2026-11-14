export class ConversationIdUtil {
  static readonly PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

  static isValid(conversationId: string): boolean {
    return ConversationIdUtil.PATTERN.test(conversationId);
  }
}
