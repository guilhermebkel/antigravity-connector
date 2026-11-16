import type {
  AgyLoginService,
  AgyRunService,
  ImageRunService,
  ImageSourceService,
  ImageUploadService,
} from "@antigravity-connector/core";
import type { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";

export type McpServices = {
  runService: AgyRunService;
  imageService: ImageRunService;
  imageSourceService: ImageSourceService;
  imageUploadService: ImageUploadService;
  publicUrl: string | undefined;
  toolJobs: ToolJobService;
  researchDailyLimit: number;
  loginService: AgyLoginService;
};
