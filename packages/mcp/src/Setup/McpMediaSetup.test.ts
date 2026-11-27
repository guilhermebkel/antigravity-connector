import { describe, expect, it } from "vitest";
import { McpHarnessUtil, type McpHarness } from "@antigravity-connector/mcp/Testing/McpHarnessUtil.ts";

const MP4_BYTES = new Uint8Array(Buffer.from("0000001866747970697361300000000000", "hex"));
const MP3_BYTES = new Uint8Array(Buffer.from("494433040000", "hex"));
const PRIVATE_QUESTION = "private-marker-7731 what happens?";
const ANALYSE_VIDEO = "analyse_video";
const CREATE_UPLOAD_LINK = "create_upload_link";
type UploadKind = "image" | "audio" | "video";
const FILE_PATTERN = /^upload:[A-Za-z0-9_-]{22}$/;

type Session = {
  harness: McpHarness;
  client: Awaited<ReturnType<typeof McpHarnessUtil.connect>>;
};

type LinkOutput = {
  uploadPath: string;
  kind: UploadKind;
  file: string;
  maxBytes: number;
};

type JobOutput = {
  status: "done" | "running";
  kind: "transcribe_audio" | "analyse_video";
  jobId: string;
  text?: string;
  retryAfterSeconds?: number;
};

const DEFAULT_ANSWER = "A cat jumps.";

const openSession = async (answer = DEFAULT_ANSWER): Promise<Session> => {
  const harness = await McpHarnessUtil.start({ answer, jobWaitMs: 2000 });
  const client = await McpHarnessUtil.connect(harness.address);
  return { harness, client };
};

const closeSession = async (session: Session): Promise<void> => {
  await session.client.close();
  await session.harness.app.close();
};

const uploadFile = async (session: Session, kind: "audio" | "video", bytes: Uint8Array): Promise<string> => {
  const created = await session.client.callTool({ name: CREATE_UPLOAD_LINK, arguments: { kind } });
  const link = created.structuredContent as LinkOutput;
  const response = await fetch(`${session.harness.address}${link.uploadPath}`, { method: "POST", body: bytes });
  expect(response.status).toBe(200);
  return link.file;
};

const readOutput = (result: unknown): JobOutput => (result as { structuredContent: JobOutput }).structuredContent;

describe("transcribe_audio and analyse_video over MCP", () => {
  it("lists both tools with the upload instructions in their descriptions", async () => {
    const session = await openSession();
    const { tools } = await session.client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("transcribe_audio");
    expect(names).toContain(ANALYSE_VIDEO);
    expect(tools.find((tool) => tool.name === ANALYSE_VIDEO)?.description).toContain("create_upload_link");
    await closeSession(session);
  });

  it("create_upload_link with kind video gives a larger limit than an image", async () => {
    const session = await openSession();
    const created = await session.client.callTool({ name: CREATE_UPLOAD_LINK, arguments: { kind: "video" } });
    const link = created.structuredContent as LinkOutput;
    expect(link.kind).toBe("video");
    expect(link.file).toMatch(FILE_PATTERN);
    expect(link.maxBytes).toBe(31457280);
    await closeSession(session);
  });

  it("analyse_video runs agy with the uploaded video attached and returns the answer", async () => {
    const session = await openSession(DEFAULT_ANSWER);
    const file = await uploadFile(session, "video", MP4_BYTES);
    const call = { name: ANALYSE_VIDEO, arguments: { file, question: PRIVATE_QUESTION } };
    const result = await session.client.callTool(call);
    expect(result.isError).not.toBe(true);
    expect(readOutput(result)).toMatchObject({ status: "done", kind: ANALYSE_VIDEO, text: DEFAULT_ANSWER });
    expect(session.harness.requests).toHaveLength(1);
    expect(session.harness.requests[0]?.attachmentNames).toStrictEqual(["attachment-1.mp4"]);
    expect(session.harness.requests[0]?.prompt).toContain(PRIVATE_QUESTION);
    await closeSession(session);
  });

  it("transcribe_audio passes the language and the timestamped format into the task", async () => {
    const session = await openSession("Hello there.");
    const file = await uploadFile(session, "audio", MP3_BYTES);
    const result = await session.client.callTool({
      name: "transcribe_audio",
      arguments: { file, language: "Portuguese", format: "timestamped" },
    });
    expect(readOutput(result)).toMatchObject({ status: "done", kind: "transcribe_audio", text: "Hello there." });
    const prompt = session.harness.requests[0]?.prompt ?? "";
    expect(prompt).toContain("The language spoken is Portuguese.");
    expect(prompt).toContain("[mm:ss]");
    expect(session.harness.requests[0]?.attachmentNames).toStrictEqual(["attachment-1.mp3"]);
    await closeSession(session);
  });

  it("refuses a video file passed to transcribe_audio before any run starts", async () => {
    const session = await openSession();
    const file = await uploadFile(session, "video", MP4_BYTES);
    const result = await session.client.callTool({ name: "transcribe_audio", arguments: { file } });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toContain("call create_upload_link with kind \"audio\"");
    expect(session.harness.requests).toHaveLength(0);
    await closeSession(session);
  });

  it("refuses a value that is not an upload reference, with what to do", async () => {
    const session = await openSession();
    await expect(
      session.client.callTool({ name: ANALYSE_VIDEO, arguments: { file: "https://example.com/a.mp4", question: "x" } }),
    ).rejects.toThrow(/call create_upload_link with kind "video"/);
    expect(session.harness.requests).toHaveLength(0);
    await closeSession(session);
  });

  it("refuses an upload that expired", async () => {
    const session = await openSession();
    const file = await uploadFile(session, "video", MP4_BYTES);
    session.harness.clock.now += 900000;
    const result = await session.client.callTool({ name: ANALYSE_VIDEO, arguments: { file, question: "x" } });
    expect(result.isError).toBe(true);
    expect(McpHarnessUtil.readFirstText(result)).toContain("was not found");
    expect(session.harness.requests).toHaveLength(0);
    await closeSession(session);
  });

  it("refuses a file that is not a video at the upload route", async () => {
    const session = await openSession();
    const created = await session.client.callTool({ name: CREATE_UPLOAD_LINK, arguments: { kind: "video" } });
    const link = created.structuredContent as LinkOutput;
    const response = await fetch(`${session.harness.address}${link.uploadPath}`, { method: "POST", body: MP3_BYTES });
    expect(response.status).toBe(415);
    await closeSession(session);
  });
});
