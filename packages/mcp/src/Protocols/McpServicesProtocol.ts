import type { AgyLoginService, AgyRunService, ImageRunService } from "@antigravity-connector/core";

export type McpServices = {
  runService: AgyRunService;
  imageService: ImageRunService;
  researchDailyLimit: number;
  loginService: AgyLoginService;
};
