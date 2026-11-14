import type { AgyEnvelope } from "@antigravity-connector/protocol";

export type AgyRunProfile = {
  isPlanMode: boolean;
  shouldSkipPermissions: boolean;
  timeoutMs: number;
  expectedOutputFileNames: readonly string[];
};

export type AgyRunRequest = {
  prompt: string;
  modelSlug: string;
  profile: AgyRunProfile;
  conversationId?: string;
  jsonSchema?: string;
};

export type AgyOutputFileNameToBytes = Readonly<Record<string, Uint8Array>>;

export type AgyRunResult = {
  envelope: AgyEnvelope;
  outputFiles: AgyOutputFileNameToBytes;
};

export interface AgyRunnerPort { run(request: AgyRunRequest): Promise<AgyRunResult> }

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
