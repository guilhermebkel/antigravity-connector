import type { Env, EnvNameToValue } from "@antigravity-connector/core/Protocols/EnvProtocol.ts";
import { EnvSchema } from "@antigravity-connector/core/Schemas/EnvSchema.ts";
import { InvalidEnvError } from "@antigravity-connector/core/Errors/InvalidEnvError.ts";

export class EnvUtil {
  static readonly UNKNOWN_NAME = "unknown";

  static load(source: EnvNameToValue): Env {
    const result = EnvSchema.safeParse(source);
    if (!result.success) {
      const names = result.error.issues.map((issue) => String(issue.path[0] ?? EnvUtil.UNKNOWN_NAME));
      throw new InvalidEnvError([...new Set(names)]);
    }
    return result.data;
  }

  static readProcessEnv(): EnvNameToValue {
    return process.env;
  }

  static loadFromProcess(): Env {
    return EnvUtil.load(EnvUtil.readProcessEnv());
  }
}
