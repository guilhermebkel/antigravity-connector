export type AgyLoginBeginResult = {
  kind: "started" | "connected" | "unavailable";
  loginUrl?: string;
  reason?: string;
};

export type AgyLoginSubmitResult = { kind: "connected" | "rejected" | "no_attempt" };

export interface AgyLoginPort {
  start(): Promise<AgyLoginBeginResult>;
  submit(code: string): Promise<AgyLoginSubmitResult>;
  stop(): void;
}
