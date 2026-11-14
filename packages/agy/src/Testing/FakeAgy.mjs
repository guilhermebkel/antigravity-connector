#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ARGUMENTS_OFFSET = 2;
const KEEP_ALIVE_MS = 1000;
const STREAM_DELAY_MS = 5;
const OUTPUT_FILE_NAME = "red_circle.png";
const FIXTURES_DIRECTORY = new URL("./fixtures/", import.meta.url);
const MODE_MARKER = /\[\[fake-agy:([a-z-]+)\]\]/;
const STREAM_OUTPUT_FORMAT = "stream-json";
const HALF_DIVISOR = 2;
const FAIL_MIDWAY_LINE_COUNT = 2;
const SLOW_STREAM_LINE_COUNT = 3;
const NO_OUTPUT = "";
const CHAT_STREAM_FIXTURE = "chatStream.ndjson";

const readFixture = (fileName) => readFileSync(new URL(fileName, FIXTURES_DIRECTORY), "utf8");
const readChatEnvelope = () => JSON.parse(readFixture("chatEnvelope.json"));
const readStreamLines = (fileName) => readFixture(fileName).split("\n").filter((line) => line !== "");
const keepAlive = () => undefined;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const buildSuccessResult = () => ({ stdout: readFixture("chatEnvelope.json"), stderr: NO_OUTPUT, exitCode: 0 });

const buildEnvNames = () => {
  const entries = readFileSync("/proc/self/environ", "utf8").split("\0").filter((entry) => entry !== "");
  return entries.map((entry) => entry.split("=")[0]).sort();
};

const buildWithResultStatus = (lines, status) => {
  const last = JSON.parse(lines[lines.length - 1]);
  const changed = { ...last, result: { ...last.result, status } };
  return [...lines.slice(0, -1), JSON.stringify(changed)];
};

const splitInHalves = (line) => {
  const middle = Math.floor(line.length / HALF_DIVISOR);
  return [line.slice(0, middle), line.slice(middle)];
};

const writeLines = async (lines, options = {}) => {
  for (const line of lines) {
    for (const piece of options.splitLines === true ? splitInHalves(line) : [line]) {
      process.stdout.write(`${piece}${options.splitLines === true ? "" : "\n"}`);
      await sleep(STREAM_DELAY_MS);
    }
    if (options.splitLines === true) {
      process.stdout.write("\n");
    }
  }
};

const streamHandlers = {
  "stream-chat": async () => {
    await writeLines(readStreamLines(CHAT_STREAM_FIXTURE));
    return { stderr: NO_OUTPUT, exitCode: 0 };
  },
  "stream-search": async () => {
    await writeLines(readStreamLines("searchStream.ndjson"));
    return { stderr: NO_OUTPUT, exitCode: 0 };
  },
  "stream-split": async () => {
    await writeLines(readStreamLines(CHAT_STREAM_FIXTURE), { splitLines: true });
    return { stderr: NO_OUTPUT, exitCode: 0 };
  },
  "stream-fail-midway": async () => {
    await writeLines(readStreamLines(CHAT_STREAM_FIXTURE).slice(0, FAIL_MIDWAY_LINE_COUNT));
    return { stderr: "boom: the stream broke\n", exitCode: 1 };
  },
  "stream-no-result": async () => {
    await writeLines(readStreamLines(CHAT_STREAM_FIXTURE).slice(0, -1));
    return { stderr: NO_OUTPUT, exitCode: 0 };
  },
  "stream-error-status": async () => {
    const lines = buildWithResultStatus(readStreamLines(CHAT_STREAM_FIXTURE), "ERROR");
    await writeLines(lines);
    return { stderr: NO_OUTPUT, exitCode: 0 };
  },
  "stream-no-session": async () => {
    process.stdout.write(readFixture("noSession.txt"));
    return { stderr: NO_OUTPUT, exitCode: 1 };
  },
  "stream-slow": async () => {
    await writeLines(readStreamLines(CHAT_STREAM_FIXTURE).slice(0, SLOW_STREAM_LINE_COUNT));
    setInterval(keepAlive, KEEP_ALIVE_MS);
    return { stderr: `fake-agy-pid=${process.pid}\n`, exitCode: null, keepRunning: true };
  },
};

const handlers = {
  "success": () => buildSuccessResult(),
  "error": () => ({ stdout: readFixture("errorEnvelope.json"), stderr: NO_OUTPUT, exitCode: 1 }),
  "no-session": () => ({ stdout: readFixture("noSession.txt"), stderr: NO_OUTPUT, exitCode: 1 }),
  "no-session-other-host": () => ({
    stdout: "Authentication required. Please visit the URL to log in:\n  https://evil.example/o/oauth2/x\n",
    stderr: NO_OUTPUT,
    exitCode: 1,
  }),
  "invalid": () => ({ stdout: "this is not json", stderr: NO_OUTPUT, exitCode: 0 }),
  "slow": () => {
    setInterval(keepAlive, KEEP_ALIVE_MS);
    return { stdout: "", stderr: `fake-agy-pid=${process.pid}\n`, exitCode: 0, keepRunning: true };
  },
  "write-file": () => {
    const outputPath = join(process.cwd(), OUTPUT_FILE_NAME);
    writeFileSync(outputPath, "FAKE-PNG");
    return buildSuccessResult();
  },
  "echo": (prompt) => {
    const envelope = readChatEnvelope();
    return { stdout: JSON.stringify({ ...envelope, response: prompt }), stderr: NO_OUTPUT, exitCode: 0 };
  },
  "env": () => {
    const envelope = readChatEnvelope();
    const names = JSON.stringify(buildEnvNames());
    return { stdout: JSON.stringify({ ...envelope, response: names }), stderr: NO_OUTPUT, exitCode: 0 };
  },
  "stderr-secret": () => ({ stdout: "", stderr: "token sk-fake-secret-123 rejected\n", exitCode: 1 }),
};

const runMain = async () => {
  const args = process.argv.slice(ARGUMENTS_OFFSET);
  const promptIndex = args.indexOf("-p") + 1;
  const prompt = args[promptIndex] ?? "";
  const mode = MODE_MARKER.exec(prompt)?.[1] ?? "success";
  const isStream = args.includes(STREAM_OUTPUT_FORMAT);
  if (isStream) {
    const streamHandler = streamHandlers[mode];
    const streamResult = streamHandler === undefined ? { stderr: `unknown fake stream mode ${mode}\n`, exitCode: 2 } : await streamHandler(prompt);
    process.stderr.write(streamResult.stderr);
    if (streamResult.keepRunning !== true) {
      process.exitCode = streamResult.exitCode;
    }
    return;
  }
  const handler = handlers[mode];
  const result = handler === undefined ? { stdout: "", stderr: `unknown fake mode ${mode}\n`, exitCode: 2 } : handler(prompt);
  const stdout = result.stdout;
  process.stdout.write(stdout.endsWith("\n") || stdout === "" ? stdout : `${stdout}\n`);
  process.stderr.write(result.stderr);
  if (result.keepRunning !== true) {
    process.exitCode = result.exitCode;
  }
};

await runMain();
