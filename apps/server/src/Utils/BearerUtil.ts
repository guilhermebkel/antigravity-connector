export class BearerUtil {
  static readonly PATTERN = /^Bearer\s+(\S+)$/i;

  static readToken(authorizationHeader: string | undefined): string | undefined {
    if (authorizationHeader === undefined) {
      return undefined;
    }
    return BearerUtil.PATTERN.exec(authorizationHeader)?.[1];
  }
}
