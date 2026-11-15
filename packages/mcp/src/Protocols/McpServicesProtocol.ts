import type { AgyLoginService, AgyRunService, ImageRunService } from "@antigravity-connector/core";
import type { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";

export type McpServices = {
  runService: AgyRunService;
  imageService: ImageRunService;
  toolJobs: ToolJobService;
  researchDailyLimit: number;
  loginService: AgyLoginService;
};
