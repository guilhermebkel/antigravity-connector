import Fastify, { type FastifyInstance } from "fastify";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  StubRuntimeUtil,
  type RemoteImageDownloadPort,
  type StubRunOptions,
  type StubRunRequest,
} from "@antigravity-connector/core";
import { McpSetup } from "@antigravity-connector/mcp/Setup/McpSetup.ts";

export const MCP_API_KEY = "test-api-key-0123456789abcdef";
export const MCP_PATH = "/mcp";
export const DAY_MS = 86400000;

export type McpHarnessOptions = StubRunOptions & {
  maxSessions?: number;
  researchDailyLimit?: number;
  sessionTtlMs?: number;
  jobWaitMs?: number;
  imageDownloader?: RemoteImageDownloadPort;
};

export type McpHarness = {
  app: FastifyInstance;
  address: string;
  clock: { now: number };
  requests: StubRunRequest[];
};

export class McpHarnessUtil {
  static readonly MAX_SESSIONS = 8;

  static readonly RESEARCH_DAILY_LIMIT = 5;

  static async start(options: McpHarnessOptions = {}): Promise<McpHarness> {
    const stub = StubRuntimeUtil.build(options);
    const clock = { now: 0 };
    const app = Fastify({ logger: false });
    McpSetup.register(app, {
      runService: stub.runService,
      clock: () => clock.now,
      sessionTtlMs: options.sessionTtlMs ?? DAY_MS,
      maxSessions: options.maxSessions ?? McpHarnessUtil.MAX_SESSIONS,
      researchDailyLimit: options.researchDailyLimit ?? McpHarnessUtil.RESEARCH_DAILY_LIMIT,
      loginService: stub.loginService,
      jobWaitMs: options.jobWaitMs,
      imageDownloader: options.imageDownloader,
    });
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    return { app, address, clock, requests: stub.requests };
  }

  static async connect(address: string): Promise<Client> {
    const client = new Client({ name: "test-client", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${address}${MCP_PATH}`), {
      requestInit: { headers: { authorization: `Bearer ${MCP_API_KEY}` } },
    });
    await client.connect(transport);
    return client;
  }

  static readFirstText(result: unknown): string {
    const { content } = result as { content: { text?: string }[] };
    return content[0]?.text ?? "";
  }
}
