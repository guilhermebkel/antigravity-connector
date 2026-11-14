import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AgyRunService } from "@antigravity-connector/core";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServerSetup } from "@antigravity-connector/mcp/Setup/McpServerSetup.ts";
import type { McpSessionService } from "@antigravity-connector/mcp/Services/McpSessionService.ts";

export type McpRouteOptions = {
  runService: AgyRunService;
  sessions: McpSessionService;
};

export class McpRoute {
  static readonly PATH = "/mcp";

  static readonly SESSION_HEADER = "mcp-session-id";

  static readonly STATUS_BAD_REQUEST = 400;

  static readonly STATUS_NOT_FOUND = 404;

  static readonly STATUS_UNAVAILABLE = 503;

  static readonly JSON_RPC_ERROR_CODE = -32000;

  static readonly SESSION_NOT_FOUND_CODE = -32001;

  static readonly POST_METHOD = "POST";

  static readonly DELETE_METHOD = "DELETE";

  static register(app: FastifyInstance, options: McpRouteOptions): void {
    app.route({
      method: ["POST", "GET", "DELETE"],
      url: McpRoute.PATH,
      handler: (request, reply) => McpRoute.handle(request, reply, options),
    });
  }

  static async handle(request: FastifyRequest, reply: FastifyReply, options: McpRouteOptions): Promise<void> {
    reply.hijack();
    const sessionId = McpRoute.readSessionId(request.headers[McpRoute.SESSION_HEADER]);
    if (sessionId !== undefined) {
      await McpRoute.handleSession(sessionId, request, reply, options);
      return;
    }
    if (request.method === McpRoute.POST_METHOD && isInitializeRequest(request.body)) {
      await McpRoute.handleInitialize(request, reply, options);
      return;
    }
    McpRoute.sendJsonError(
      reply.raw,
      McpRoute.STATUS_BAD_REQUEST,
      McpRoute.JSON_RPC_ERROR_CODE,
      "Bad Request: send initialize without a session id first, then pass the Mcp-Session-Id header.",
    );
  }

  static async handleSession(
    sessionId: string,
    request: FastifyRequest,
    reply: FastifyReply,
    options: McpRouteOptions,
  ): Promise<void> {
    const entry = options.sessions.find(sessionId);
    if (entry === undefined) {
      McpRoute.sendJsonError(
        reply.raw,
        McpRoute.STATUS_NOT_FOUND,
        McpRoute.SESSION_NOT_FOUND_CODE,
        "Session not found. It may have expired; start a new session with initialize.",
      );
      return;
    }
    await entry.transport.handleRequest(request.raw, reply.raw, request.body);
    if (request.method === McpRoute.DELETE_METHOD) {
      options.sessions.close(sessionId);
    }
  }

  static async handleInitialize(request: FastifyRequest, reply: FastifyReply, options: McpRouteOptions): Promise<void> {
    if (!options.sessions.hasRoom()) {
      McpRoute.sendJsonError(
        reply.raw,
        McpRoute.STATUS_UNAVAILABLE,
        McpRoute.JSON_RPC_ERROR_CODE,
        "Too many MCP sessions are open. Wait for one to expire, then retry.",
      );
      return;
    }
    const server = McpServerSetup.build(options.runService);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        options.sessions.open(sessionId, transport, server);
      },
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  }

  static readSessionId(header: string | string[] | undefined): string | undefined {
    return typeof header === "string" ? header : undefined;
  }

  static sendJsonError(response: ServerResponse, statusCode: number, code: number, message: string): void {
    response.writeHead(statusCode, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
  }
}
