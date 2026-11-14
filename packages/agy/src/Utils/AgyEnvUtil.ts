import type { AgyChildEnvName, AgyEnvNameToValue } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export class AgyEnvUtil {
  static readonly ALLOWED_NAMES: readonly AgyChildEnvName[] = ["HOME", "PATH", "LANG", "TMPDIR"];

  static build(parentEnv: AgyEnvNameToValue): Record<string, string> {
    const childEnvNameToValue: Record<string, string> = {};
    for (const name of AgyEnvUtil.ALLOWED_NAMES) {
      const value = parentEnv[name];
      if (value !== undefined) {
        childEnvNameToValue[name] = value;
      }
    }
    return childEnvNameToValue;
  }
}
