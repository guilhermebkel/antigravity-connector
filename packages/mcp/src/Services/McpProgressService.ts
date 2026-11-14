import type { RunProgressEvent } from "@antigravity-connector/core";
import { McpProgressUtil } from "@antigravity-connector/mcp/Utils/McpProgressUtil.ts";

export type McpProgressSend = (progress: number, message: string) => void;

export type McpProgressOptions = {
  send: McpProgressSend;
  clock: () => number;
};

export class McpProgressService {
  // Why: queued and started happen once per call, so they are sent at once; only the repeated text and activity updates are rate-limited.
  static readonly MIN_INTERVAL_MS = 1000;

  static readonly HEARTBEAT_MS = 15000;

  private readonly send: McpProgressSend;

  private readonly clock: () => number;

  private progress = 0;

  private lastSentAtMs = Number.NEGATIVE_INFINITY;

  private pendingMessage: string | undefined = undefined;

  private lastMessage = McpProgressUtil.DEFAULT_MESSAGE;

  private flushTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  private heartbeat: ReturnType<typeof setInterval> | undefined = undefined;

  constructor(options: McpProgressOptions) {
    this.send = options.send;
    this.clock = options.clock;
  }

  start(): void {
    this.heartbeat = setInterval(() => {
      this.emit(this.lastMessage);
    }, McpProgressService.HEARTBEAT_MS);
  }

  observe(event: RunProgressEvent): void {
    const message = McpProgressUtil.describe(event);
    if (McpProgressUtil.isImmediate(event)) {
      this.pendingMessage = undefined;
      this.emit(message);
      return;
    }
    this.request(message);
  }

  close(): void {
    clearInterval(this.heartbeat);
    clearTimeout(this.flushTimer);
    this.heartbeat = undefined;
    this.flushTimer = undefined;
    if (this.pendingMessage !== undefined) {
      this.emit(this.pendingMessage);
    }
  }

  private request(message: string): void {
    const waitMs = this.lastSentAtMs + McpProgressService.MIN_INTERVAL_MS - this.clock();
    if (waitMs <= 0) {
      this.emit(message);
      return;
    }
    this.pendingMessage = message;
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = undefined;
      if (this.pendingMessage !== undefined) {
        this.emit(this.pendingMessage);
      }
    }, waitMs);
  }

  private emit(message: string): void {
    this.pendingMessage = undefined;
    this.lastMessage = message;
    this.lastSentAtMs = this.clock();
    this.progress += 1;
    this.send(this.progress, message);
  }
}
