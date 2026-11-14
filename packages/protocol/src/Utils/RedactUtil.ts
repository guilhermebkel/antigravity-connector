export class RedactUtil {
  static readonly REDACTED = "[redacted]";

  static readonly BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

  static readonly OPENAI_STYLE_KEY_PATTERN = /sk-[A-Za-z0-9_-]{6,}/g;

  static readonly OAUTH_ACCESS_TOKEN_PATTERN = /ya29\.[A-Za-z0-9_-]+/g;

  static readonly OAUTH_AUTH_CODE_PATTERN = /4\/0[A-Za-z0-9_-]{10,}/g;

  static readonly MAX_EXCERPT_LENGTH = 500;

  static redact(text: string, secrets: readonly string[]): string {
    const withoutSecrets = secrets
      .filter((secret) => secret.length > 0)
      .reduce((current, secret) => current.split(secret).join(RedactUtil.REDACTED), text);
    return [
      RedactUtil.BEARER_PATTERN,
      RedactUtil.OPENAI_STYLE_KEY_PATTERN,
      RedactUtil.OAUTH_ACCESS_TOKEN_PATTERN,
      RedactUtil.OAUTH_AUTH_CODE_PATTERN,
    ].reduce((current, pattern) => current.replace(pattern, RedactUtil.REDACTED), withoutSecrets);
  }

  static buildExcerpt(text: string, secrets: readonly string[]): string {
    const redacted = RedactUtil.redact(text, secrets);
    return redacted.length > RedactUtil.MAX_EXCERPT_LENGTH ? `${redacted.slice(0, RedactUtil.MAX_EXCERPT_LENGTH)}...` : redacted;
  }
}
