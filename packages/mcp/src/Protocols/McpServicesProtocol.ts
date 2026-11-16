import type { AgyLoginService, AgyRunService, ImageRunService, ImageSourceService } from "@antigravity-connector/core";
import type { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";

export type McpServices = {
  runService: AgyRunService;
  imageService: ImageRunService;
  imageSourceService: ImageSourceService;
  toolJobs: ToolJobService;
  researchDailyLimit: number;
  loginService: AgyLoginService;
};
