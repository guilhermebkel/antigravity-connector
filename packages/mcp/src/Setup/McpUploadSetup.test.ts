import { describe, expect, it } from "vitest";
import { StubRuntimeUtil, type StubRunResult } from "@antigravity-connector/core";
import { McpHarnessUtil, type McpHarness } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const JPEG_BYTES = Buffer.from("ffd8ffe000104a46", "hex");
const PROMPT = "Remove the television";
const FOUR_MIB = 4194304;
const LINK_LIFETIME_MS = 300000;
const ENTRY_LIMIT = 8;
const UPLOAD_PATH_PATTERN = /^\/upload\/[A-Za-z0-9_-]{43}$/;
const FILE_PATTERN = /^upload:[A-Za-z0-9_-]{22}$/;

const buildPng = (): Promise<StubRunResult> => Promise.resolve({
  ...StubRuntimeUtil.buildResult("image"),
  outputFiles: { "output.png": new Uint8Array(PNG_BYTES) },
});

type UploadLink = {
  uploadPath: string;
  uploadUrl?: string;
  kind: "image" | "audio" | "video";
  file: string;
  expiresInSeconds: number;
  maxBytes: number;
};

type Session = {
  harness: McpHarness;
  client: Awaited<ReturnType<typeof McpHarnessUtil.connect>>;
};

const openSession = async (publicUrl?: string): Promise<Session> => {
  const harness = await McpHarnessUtil.start({ respond: buildPng, publicUrl });
  const client = await McpHarnessUtil.connect(harness.address);
  return { harness, client };
};

const closeSession = async (session: Session): Promise<void> => {
  await session.client.close();
  await session.harness.app.close();
};

const createLink = async (session: Session): Promise<UploadLink> => {
  const result = await session.client.callTool({ name: "create_upload_link", arguments: {} });
  return result.structuredContent as UploadLink;
};

type HeaderNameToValue = Record<string, string>;

const upload = (
  session: Session,
  path: string,
  body: Uint8Array,
  headers: HeaderNameToValue = {},
): Promise<Response> => {
  return fetch(`${session.harness.address}${path}`, { method: "POST", body, headers });
};

describe("create_upload_link over MCP", () => {
  it("returns a one-time path, the file value to use, the lifetime and the size limit", async () => {
    const session = await openSession();
    const link = await createLink(session);
    expect(link.uploadPath).toMatch(UPLOAD_PATH_PATTERN);
    expect(link.file).toMatch(FILE_PATTERN);
    expect(link.expiresInSeconds).toBe(300);
    expect(link.maxBytes).toBe(FOUR_MIB);
    await closeSession(session);
  });

  it("gives no uploadUrl when the server does not know its public address", async () => {
    const session = await openSession();
    const link = await createLink(session);
    expect(Object.keys(link)).toStrictEqual(["uploadPath", "kind", "file", "expiresInSeconds", "maxBytes"]);
    await closeSession(session);
  });

  it("gives the full uploadUrl, the public address followed by the path, when PUBLIC_URL is set", async () => {
    const session = await openSession("https://connector.example.com");
    const link = await createLink(session);
    expect(link.uploadUrl).toBe(`https://connector.example.com${link.uploadPath}`);
    await closeSession(session);
  });

  it("is listed with a description that says what to send and where", async () => {
    const session = await openSession();
    const { tools } = await session.client.listTools();
    const tool = tools.find((candidate) => candidate.name === "create_upload_link");
    expect(tool?.description).toMatch(/raw body of a POST to uploadUrl/);
    expect(tool?.description).toMatch(/starts no agy run and spends no quota/);
    await closeSession(session);
  });

  it("a picture uploaded without a bearer key reaches agy as an attachment of generate_image", async () => {
    const session = await openSession();
    const link = await createLink(session);
    const response = await upload(session, link.uploadPath, JPEG_BYTES);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ kind: "image", file: link.file, mimeType: "image/jpeg", sizeBytes: 8 });
    const result = await session.client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [link.file] },
    });
    expect(result.isError).not.toBe(true);
    expect(session.harness.requests.map((request) => request.attachmentNames)).toStrictEqual([["attachment-1.jpg"]]);
    await closeSession(session);
  });

  it("lets two calls use the same uploaded picture", async () => {
    const session = await openSession();
    const link = await createLink(session);
    await upload(session, link.uploadPath, PNG_BYTES);
    await session.client.callTool({ name: "generate_image", arguments: { prompt: PROMPT, images: [link.file] } });
    await session.client.callTool({ name: "generate_image", arguments: { prompt: PROMPT, images: [link.file] } });
    expect(session.harness.requests.map((request) => request.attachmentNames)).toStrictEqual([
      ["attachment-1.png"],
      ["attachment-1.png"],
    ]);
    await closeSession(session);
  });

  it("reads the body as bytes whatever the content type says, JSON included", async () => {
    const session = await openSession();
    const link = await createLink(session);
    const response = await upload(session, link.uploadPath, PNG_BYTES, { "content-type": "application/json" });
    expect(response.status).toBe(200);
    await closeSession(session);
  });

  it("refuses a second upload on the same link, and the error does not repeat the token", async () => {
    const session = await openSession();
    const link = await createLink(session);
    await upload(session, link.uploadPath, PNG_BYTES);
    const response = await upload(session, link.uploadPath, PNG_BYTES);
    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).toBe(JSON.stringify({
      error: "The upload link is unknown, expired or already used. What to do: call create_upload_link again.",
    }));
    expect(text).not.toContain(link.uploadPath.split("/")[2]);
    await closeSession(session);
  });

  it("refuses a link nobody issued", async () => {
    const session = await openSession();
    const response = await upload(session, `/upload/${"A".repeat(43)}`, PNG_BYTES);
    expect(response.status).toBe(404);
    expect(session.harness.requests).toHaveLength(0);
    await closeSession(session);
  });

  it("refuses a link nobody issued before reading its body: an oversized file gets 404, not 413", async () => {
    const session = await openSession();
    const response = await upload(session, `/upload/${"A".repeat(43)}`, Buffer.alloc(FOUR_MIB + 1));
    expect(response.status).toBe(404);
    await closeSession(session);
  });

  it("refuses a link after 5 minutes", async () => {
    const session = await openSession();
    const link = await createLink(session);
    session.harness.clock.now += LINK_LIFETIME_MS;
    const response = await upload(session, link.uploadPath, PNG_BYTES);
    expect(response.status).toBe(404);
    await closeSession(session);
  });

  it("answers 415 to a file that is not a picture and keeps the link for the right one", async () => {
    const session = await openSession();
    const link = await createLink(session);
    const refused = await upload(session, link.uploadPath, Buffer.from("<html>not a picture</html>"));
    expect(refused.status).toBe(415);
    const accepted = await upload(session, link.uploadPath, PNG_BYTES);
    expect(accepted.status).toBe(200);
    await closeSession(session);
  });

  it("answers 415 to an empty body", async () => {
    const session = await openSession();
    const link = await createLink(session);
    const response = await fetch(`${session.harness.address}${link.uploadPath}`, { method: "POST" });
    expect(response.status).toBe(415);
    await closeSession(session);
  });

  it("answers 413 to a file over 4 MiB, and 200 to one of exactly 4 MiB", async () => {
    const session = await openSession();
    const link = await createLink(session);
    const exact = Buffer.alloc(FOUR_MIB);
    PNG_BYTES.copy(exact);
    const tooLarge = await upload(session, link.uploadPath, Buffer.alloc(FOUR_MIB + 1));
    expect(tooLarge.status).toBe(413);
    const accepted = await upload(session, link.uploadPath, exact);
    expect(accepted.status).toBe(200);
    await closeSession(session);
  });

  it("refuses a generate_image call whose upload never arrived, before any run starts", async () => {
    const session = await openSession();
    const link = await createLink(session);
    const result = await session.client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: [link.file] },
    });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toMatch(/^The call did not run: A file reference points to an upload that was not found/);
    expect(session.harness.requests).toHaveLength(0);
    await closeSession(session);
  });

  it("refuses an upload: value that is not one create_upload_link returned, before any run starts", async () => {
    const session = await openSession();
    await expect(session.client.callTool({
      name: "generate_image",
      arguments: { prompt: PROMPT, images: ["upload:short"] },
    })).rejects.toThrow(/The upload reference is not valid. What to do: pass the file value exactly as create_upload_link returned it/);
    expect(session.harness.requests).toHaveLength(0);
    await closeSession(session);
  });

  it("refuses a ninth waiting upload, with an error that says what to do", async () => {
    const session = await openSession();
    await Promise.all(Array.from({ length: ENTRY_LIMIT }, () => createLink(session)));
    const result = await session.client.callTool({ name: "create_upload_link", arguments: {} });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toMatch(/^The call did not run: Too many uploads are waiting/);
    await closeSession(session);
  });
});
