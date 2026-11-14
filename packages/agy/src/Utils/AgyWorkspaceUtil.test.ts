import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgyRunRequest } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";
import { AgyWorkspaceUtil } from "@antigravity-connector/agy/Utils/AgyWorkspaceUtil.ts";

const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);
const SCHEMA = "{\"type\":\"object\"}";

let directory = "";

const buildRequest = (overrides: Partial<AgyRunRequest> = {}): AgyRunRequest => ({
  prompt: "User: hi",
  modelSlug: "gemini-3.8-flash-low",
  profile: { isPlanMode: true, shouldSkipPermissions: false, timeoutMs: 1000, expectedOutputFileNames: [] },
  ...overrides,
});

beforeEach(() => {
  const prefix = join(tmpdir(), "acon-workspace-");
  directory = mkdtempSync(prefix);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("AgyWorkspaceUtil.writeInputs", () => {
  it("writes each attachment and the schema file, and returns the schema path", async () => {
    const request = buildRequest({ attachments: [{ fileName: "attachment-1.png", bytes: PNG_BYTES }], jsonSchema: SCHEMA });

    const schemaPath = await AgyWorkspaceUtil.writeInputs(directory, request);

    expect(schemaPath).toBe(join(directory, AgyWorkspaceUtil.SCHEMA_FILE_NAME));
    const attachmentPath = join(directory, "attachment-1.png");
    expect(readFileSync(attachmentPath)).toStrictEqual(Buffer.from(PNG_BYTES));
    expect(readFileSync(schemaPath ?? "", "utf8")).toBe(SCHEMA);
  });

  it("returns undefined and writes nothing when there is no schema", async () => {
    const schemaPath = await AgyWorkspaceUtil.writeInputs(directory, buildRequest());

    expect(schemaPath).toBeUndefined();
  });
});
