import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpSessionEntry } from "@antigravity-connector/mcp/Protocols/McpSessionProtocol.ts";

export type McpSessionOptions = {
  ttlMs: number;
  maxSessions: number;
  clock: () => number;
};

export class McpSessionService {
  private readonly ttlMs: number;

  private readonly maxSessions: number;

  private readonly clock: () => number;

  private readonly sessionIdToEntry = new Map<string, McpSessionEntry>();

  constructor(options: McpSessionOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSessions = options.maxSessions;
    this.clock = options.clock;
  }

  hasRoom(): boolean {
    this.removeExpired();
    return this.sessionIdToEntry.size < this.maxSessions;
  }

  open(sessionId: string, transport: StreamableHTTPServerTransport, server: McpServer): void {
    this.sessionIdToEntry.set(sessionId, { transport, server, lastSeenAtMs: this.clock() });
  }

  find(sessionId: string): McpSessionEntry | undefined {
    this.removeExpired();
    const entry = this.sessionIdToEntry.get(sessionId);
    if (entry !== undefined) {
      entry.lastSeenAtMs = this.clock();
    }
    return entry;
  }

  close(sessionId: string): void {
    const entry = this.sessionIdToEntry.get(sessionId);
    if (entry === undefined) {
      return;
    }
    this.sessionIdToEntry.delete(sessionId);
    void entry.transport.close();
  }

  private removeExpired(): void {
    const now = this.clock();
    for (const [sessionId, entry] of this.sessionIdToEntry) {
      if (now - entry.lastSeenAtMs >= this.ttlMs) {
        this.close(sessionId);
      }
    }
  }
}
