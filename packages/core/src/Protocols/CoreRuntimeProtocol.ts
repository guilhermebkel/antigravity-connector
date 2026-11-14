import type { AgyRunService } from "@antigravity-connector/core/Services/AgyRunService.ts";
import type { AgySessionService } from "@antigravity-connector/core/Services/AgySessionService.ts";

export type CoreRuntime = {
  runService: AgyRunService;
  sessionService: AgySessionService;
  stopRunningCalls: () => void;
  checkSession: () => Promise<void>;
};
