import type { AgyEnvelope, AgyStepType } from "@antigravity-connector/protocol";

export type AgyRunProfile = {
  isPlanMode: boolean;
  shouldSkipPermissions: boolean;
  timeoutMs: number;
  expectedOutputFileNames: readonly string[];
};

export type AgyAttachment = {
  fileName: string;
  bytes: Uint8Array;
};

export type AgyRunRequest = {
  prompt: string;
  modelSlug: string;
  profile: AgyRunProfile;
  conversationId?: string;
  jsonSchema?: string;
  attachments?: readonly AgyAttachment[];
};

export type AgyOutputFormat = "json" | "stream-json";

export type AgyOutputFileNameToBytes = Readonly<Record<string, Uint8Array>>;

export type AgyRunResult = {
  envelope: AgyEnvelope;
  outputFiles: AgyOutputFileNameToBytes;
};

export type AgyStartedEvent = {
  kind: "started";
  conversationId: string;
};

export type AgyTextEvent = {
  kind: "text";
  delta: string;
};

export type AgyActivityEvent = {
  kind: "activity";
  stepType: AgyStepType;
};

export type AgyFinishedEvent = {
  kind: "finished";
  envelope: AgyEnvelope;
};

export type AgyStreamOutputEvent = AgyStartedEvent | AgyTextEvent | AgyActivityEvent | AgyFinishedEvent;

export interface AgyRunnerPort {
  run(request: AgyRunRequest, signal?: AbortSignal): Promise<AgyRunResult>;
  stream(request: AgyRunRequest, signal?: AbortSignal): AsyncIterable<AgyStreamOutputEvent>;
}

export type AgyProcessOutcome = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  isTimedOut: boolean;
};

export type AgyEnvNameToValue = Readonly<Record<string, string | undefined>>;

export type AgyChildEnvName = "HOME" | "PATH" | "LANG" | "TMPDIR";

export type AgyCliAdapterOptions = {
  binaryPath: string;
  tempRoot: string;
  parentEnv: AgyEnvNameToValue;
};
