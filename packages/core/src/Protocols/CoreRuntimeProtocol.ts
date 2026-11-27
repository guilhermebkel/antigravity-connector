import type { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import type { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";
import type { AgyUsageService } from "@antigravity-connector/core/Services/AgyUsageService.ts";
import type { AgyLoginService } from "@antigravity-connector/core/Services/AgyLoginService.ts";

export type CoreRuntime = {
  runService: AgyRunService;
  sessionService: AgySessionService;
  loginService: AgyLoginService;
  usageService: AgyUsageService;
  stopRunningCalls: () => void;
  checkSession: () => Promise<void>;
};
