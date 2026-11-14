export class HttpPathUtil {
  static readonly HEALTH_PATH = "/health";

  static readonly OPENAI_PATH = "/v1";

  static readonly BASE_URL = "http://127.0.0.1";

  static readPath(url: string): string {
    return new URL(url, HttpPathUtil.BASE_URL).pathname;
  }

  static isOpenAiPath(path: string): boolean {
    return path === HttpPathUtil.OPENAI_PATH || path.startsWith(`${HttpPathUtil.OPENAI_PATH}/`);
  }
}
