import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgyCliAdapter } from "@antigravity-connector/agy/Adapters/AgyCliAdapter.ts";
import { AgyFailedError } from "@antigravity-connector/agy/Errors/AgyFailedError.ts";
import { AgyOutputError } from "@antigravity-connector/agy/Errors/AgyOutputError.ts";
import { AgySessionRequiredError } from "@antigravity-connector/agy/Errors/AgySessionRequiredError.ts";
import { AgyTimeoutError } from "@antigravity-connector/agy/Errors/AgyTimeoutError.ts";
import type { AgyEnvNameToValue, AgyRunProfile, AgyRunRequest } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

const FAKE_BINARY = resolve(import.meta.dirname, "../Testing/FakeAgy.mjs");
const CHAT_FIXTURE = resolve(import.meta.dirname, "../Testing/fixtures/chatEnvelope.json");
const FAKE_API_KEY = "test-api-key-0123456789abcdef";
const FAKE_SECRET = "sk-fake-secret-123";
const DEFAULT_TIMEOUT_MS = 20000;
const SLOW_TIMEOUT_MS = 300;
const PID_PATTERN = /fake-agy-pid=(\d+)/;
const OUTPUT_FILE_NAME = "red_circle.png";
const CHAT_PROFILE: AgyRunProfile = {
  isPlanMode: true,
  shouldSkipPermissions: false,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  expectedOutputFileNames: [],
};

let tempRoot = "";

const buildParentEnv = (extra: AgyEnvNameToValue = {}): AgyEnvNameToValue => ({
  PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
  HOME: tempRoot,
  LANG: "C.UTF-8",
  ...extra,
});

const buildAdapter = (extraEnv: AgyEnvNameToValue = {}): AgyCliAdapter =>
  new AgyCliAdapter({ binaryPath: FAKE_BINARY, parentEnv: buildParentEnv(extraEnv), tempRoot });

const buildRequest = (prompt: string, profile: Partial<AgyRunProfile> = {}): AgyRunRequest => ({
  modelSlug: "gemini-3.8-flash-low",
  profile: { ...CHAT_PROFILE, ...profile },
  prompt,
});

const captureFailure = async (run: Promise<unknown>): Promise<unknown> => {
  const outcome = await run.then(
    () => new Error("the run unexpectedly succeeded"),
    (error: unknown) => error,
  );
  return outcome;
};

const failRun = (prompt: string, profile: Partial<AgyRunProfile> = {}): Promise<unknown> => {
  const request = buildRequest(prompt, profile);
  const run = buildAdapter().run(request);
  return captureFailure(run);
};

const runPrompt = (prompt: string, profile: Partial<AgyRunProfile> = {}): ReturnType<AgyCliAdapter["run"]> => {
  const request = buildRequest(prompt, profile);
  return buildAdapter().run(request);
};

const readErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : "");

const readTimeoutStderr = (error: unknown): string => (error instanceof AgyTimeoutError ? error.stderrExcerpt : "");

const readLoginUrl = (error: unknown): string | undefined =>
  error instanceof AgySessionRequiredError ? error.loginUrl : undefined;

beforeEach(() => {
  const prefix = join(tmpdir(), "agy-adapter-test-");
  tempRoot = mkdtempSync(prefix);
  chmodSync(FAKE_BINARY, 0o755);
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("AgyCliAdapter.run", () => {
  it("resolves with the envelope recorded in the fixture", async () => {
    const result = await runPrompt("[[fake-agy:success]] hi");
    const fixture = JSON.parse(readFileSync(CHAT_FIXTURE, "utf8")) as { response: string };

    expect(result.envelope.response).toBe("Pong! How can I help you today?\n");
    expect(result.envelope.response).toBe(fixture.response);
    expect(result.envelope.usage).toStrictEqual({
      input_tokens: 9420,
      output_tokens: 13,
      thinking_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 9433,
    });
  });

  it("removes its temporary directory after a successful run", async () => {
    await runPrompt("[[fake-agy:success]] hi");
    const remaining = readdirSync(tempRoot);

    expect(remaining).toStrictEqual([]);
  });

  it("removes its temporary directory after a failed run", async () => {
    await failRun("[[fake-agy:error]] hi");
    const remaining = readdirSync(tempRoot);

    expect(remaining).toStrictEqual([]);
  });

  it("rejects with AgyTimeoutError and leaves no child process running", async () => {
    const error = await failRun("[[fake-agy:slow]] hi", { timeoutMs: SLOW_TIMEOUT_MS });
    const pid = Number(PID_PATTERN.exec(readTimeoutStderr(error))?.[1]);

    expect(error).toBeInstanceOf(AgyTimeoutError);
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow("ESRCH");
  });

  it("rejects with AgySessionRequiredError carrying the login URL when there is no session", async () => {
    const error = await failRun("[[fake-agy:no-session]] hi");

    expect(error).toBeInstanceOf(AgySessionRequiredError);
    expect(readLoginUrl(error)).toBe("https://accounts.google.com/o/oauth2/EXAMPLE");
  });

  it("returns the bytes of the output file the run wrote", async () => {
    const result = await runPrompt("[[fake-agy:write-file]] draw", { expectedOutputFileNames: [OUTPUT_FILE_NAME] });
    const bytes = result.outputFiles[OUTPUT_FILE_NAME];

    expect(new TextDecoder().decode(bytes)).toBe("FAKE-PNG");
  });

  it("rejects with AgyOutputError when an expected output file is missing", async () => {
    const error = await failRun("[[fake-agy:success]] draw", { expectedOutputFileNames: [OUTPUT_FILE_NAME] });

    expect(error).toBeInstanceOf(AgyOutputError);
  });

  it("passes the prompt to the binary byte for byte, as one argument", async () => {
    const prompt = "[[fake-agy:echo]] say \"hi\"\nline two with `backticks` and $(rm -rf x) and 'quotes'";

    const result = await runPrompt(prompt);

    expect(result.envelope.response).toBe(prompt);
  });

  it("does not pass the API key to the child environment", async () => {
    const adapter = buildAdapter({ API_KEY: FAKE_API_KEY });
    const request = buildRequest("[[fake-agy:env]] list");

    const result = await adapter.run(request);
    const names = JSON.parse(result.envelope.response) as string[];

    expect(names).toStrictEqual(["HOME", "LANG", "PATH"]);
  });

  it("does not put a planted secret from stderr into the error message", async () => {
    const error = await failRun("[[fake-agy:stderr-secret]] hi");
    const message = readErrorMessage(error);

    expect(error).toBeInstanceOf(AgyFailedError);
    expect(message).toContain("[redacted]");
    expect(message).not.toContain(FAKE_SECRET);
  });

  it("rejects with AgyOutputError when stdout is not an envelope", async () => {
    const error = await failRun("[[fake-agy:invalid]] hi");

    expect(error).toBeInstanceOf(AgyOutputError);
  });
});
