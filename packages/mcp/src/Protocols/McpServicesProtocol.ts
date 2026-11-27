import type {
  AgyLoginService,
  AgyRunService,
  AgyUsageService,
  ImageRunService,
  ImageSourceService,
  MediaUploadService,
  MediaRunService,
} from "@antigravity-connector/core";
import type { ToolJobService } from "@antigravity-connector/mcp/Services/ToolJobService.ts";

export type McpServices = {
  runService: AgyRunService;
  imageService: ImageRunService;
  imageSourceService: ImageSourceService;
  mediaUploadService: MediaUploadService;
  mediaService: MediaRunService;
  publicUrl: string | undefined;
  toolJobs: ToolJobService;
  researchDailyLimit: number;
  loginService: AgyLoginService;
  usageService: AgyUsageService;
};
