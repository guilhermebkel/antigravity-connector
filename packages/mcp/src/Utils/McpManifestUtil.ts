import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  McpError,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { RunObserver } from "@antigravity-connector/core";
import type { McpToolContext, McpToolPort } from "@antigravity-connector/mcp/Protocols/McpToolProtocol.ts";
import type { McpServices } from "@antigravity-connector/mcp/Protocols/McpServicesProtocol.ts";
import { BrowseTool } from "@antigravity-connector/mcp/Tools/BrowseTool.ts";
import { CreateUploadLinkTool } from "@antigravity-connector/mcp/Tools/CreateUploadLinkTool.ts";
import { CheckAuthTool } from "@antigravity-connector/mcp/Tools/CheckAuthTool.ts";
import { SetAuthTool } from "@antigravity-connector/mcp/Tools/SetAuthTool.ts";
import { GenerateImageTool } from "@antigravity-connector/mcp/Tools/GenerateImageTool.ts";
import { GetResultTool } from "@antigravity-connector/mcp/Tools/GetResultTool.ts";
import { ResearchTool } from "@antigravity-connector/mcp/Tools/ResearchTool.ts";
import { WebSearchTool } from "@antigravity-connector/mcp/Tools/WebSearchTool.ts";
import { McpProgressService } from "@antigravity-connector/mcp/Services/McpProgressService.ts";
import { McpErrorUtil } from "@antigravity-connector/mcp/Utils/McpErrorUtil.ts";
import { McpResultUtil } from "@antigravity-connector/mcp/Utils/McpResultUtil.ts";

type ToolRunner = (args: unknown, context: McpToolContext) => Promise<CallToolResult>;

type ProgressSession = {
  observer: RunObserver;
  close: () => void;
};

const buildNoopObserver = (): RunObserver => () => undefined;

const buildNoopClose = (): (() => void) => () => undefined;

export class McpManifestUtil {
  static registerAll(server: McpServer, services: McpServices): void {
    const webSearch = new WebSearchTool();
    const generateImage = new GenerateImageTool();
    const getResult = new GetResultTool();
    const research = new ResearchTool({ dailyLimit: services.researchDailyLimit });
    const browse = new BrowseTool();
    const createUploadLink = new CreateUploadLinkTool({ publicUrl: services.publicUrl });
    McpManifestUtil.registerTool(server, webSearch, services);
    McpManifestUtil.registerTool(server, generateImage, services);
    McpManifestUtil.registerTool(server, getResult, services);
    McpManifestUtil.registerTool(server, research, services);
    McpManifestUtil.registerTool(server, browse, services);
    McpManifestUtil.registerTool(server, createUploadLink, services);
    const checkAuth = new CheckAuthTool();
    const setAuth = new SetAuthTool();
    McpManifestUtil.registerTool(server, checkAuth, services);
    McpManifestUtil.registerTool(server, setAuth, services);
    const toolNameToRunner = new Map<string, ToolRunner>([
      McpManifestUtil.buildRunnerEntry(webSearch),
      McpManifestUtil.buildRunnerEntry(generateImage),
      McpManifestUtil.buildRunnerEntry(getResult),
      McpManifestUtil.buildRunnerEntry(research),
      McpManifestUtil.buildRunnerEntry(browse),
      McpManifestUtil.buildRunnerEntry(createUploadLink),
      McpManifestUtil.buildRunnerEntry(checkAuth),
      McpManifestUtil.buildRunnerEntry(setAuth),
    ]);
    server.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const runner = toolNameToRunner.get(request.params.name);
      if (runner === undefined) {
        throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
      }
      const progress = McpManifestUtil.openProgress(extra);
      try {
        return await runner(request.params.arguments, {
          runService: services.runService,
          imageService: services.imageService,
          imageSourceService: services.imageSourceService,
          imageUploadService: services.imageUploadService,
          toolJobs: services.toolJobs,
          loginService: services.loginService,
          signal: extra.signal,
          observer: progress.observer,
        });
      } finally {
        progress.close();
      }
    });
  }

  static buildRunnerEntry<I, O extends Record<string, unknown>>(tool: McpToolPort<I, O>): [string, ToolRunner] {
    return [tool.name, (args, context) => McpManifestUtil.callWith(tool, args, context)];
  }

  static registerTool<I, O extends Record<string, unknown>>(
    server: McpServer,
    tool: McpToolPort<I, O>,
    services: McpServices,
  ): void {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      async (input, extra) => McpManifestUtil.invoke(tool, input, {
        runService: services.runService,
        imageService: services.imageService,
        imageSourceService: services.imageSourceService,
        imageUploadService: services.imageUploadService,
        toolJobs: services.toolJobs,
        loginService: services.loginService,
        signal: extra.signal,
        observer: buildNoopObserver(),
      }),
    );
  }

  static async callWith<I, O extends Record<string, unknown>>(
    tool: McpToolPort<I, O>,
    args: unknown,
    context: McpToolContext,
  ): Promise<CallToolResult> {
    const parsed = tool.inputSchema.safeParse(args);
    if (!parsed.success) {
      const message = McpManifestUtil.describeIssues(tool.name, parsed.error.issues);
      throw new McpError(ErrorCode.InvalidParams, message);
    }
    return McpManifestUtil.invoke(tool, parsed.data, context);
  }

  static async invoke<I, O extends Record<string, unknown>>(
    tool: McpToolPort<I, O>,
    input: I,
    context: McpToolContext,
  ): Promise<CallToolResult> {
    try {
      const run = await tool.run(input, context);
      return McpResultUtil.buildSuccess(run.output, tool.summarize(run.output), run.extraContent);
    } catch (error: unknown) {
      return McpResultUtil.buildFailure(McpErrorUtil.describe(error));
    }
  }

  static openProgress(extra: { _meta?: { progressToken?: string | number } } & {
    sendNotification: (notification: {
      method: "notifications/progress";
      params: {
        progressToken: string | number; progress: number; message: string;
      };
    }) => Promise<void>;
  }): ProgressSession {
    const progressToken = extra._meta?.progressToken;
    if (progressToken === undefined) {
      return { observer: buildNoopObserver(), close: buildNoopClose() };
    }
    const service = new McpProgressService({
      clock: Date.now,
      send: (progress, message) => {
        extra.sendNotification({
          method: "notifications/progress",
          params: { progressToken, progress, message },
        }).catch(buildNoopClose());
      },
    });
    service.start();
    return { observer: (event) => {
      service.observe(event);
    }, close: () => {
      service.close();
    } };
  }

  static describeIssues(toolName: string, issues: readonly { message: string }[]): string {
    const details = issues.map((issue) => issue.message).join("; ");
    return `Invalid arguments for tool ${toolName}: ${details}`;
  }

  static describeError(error: unknown): string {
    return McpErrorUtil.describe(error);
  }
}
