#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ARGUMENTS_OFFSET = 2;
const KEEP_ALIVE_MS = 1000;
const OUTPUT_FILE_NAME = "red_circle.png";
const FIXTURES_DIRECTORY = new URL("./fixtures/", import.meta.url);
const MODE_MARKER = /\[\[fake-agy:([a-z-]+)\]\]/;

const readFixture = (fileName) => readFileSync(new URL(fileName, FIXTURES_DIRECTORY), "utf8");
const readChatEnvelope = () => JSON.parse(readFixture("chatEnvelope.json"));
const keepAlive = () => undefined;

const buildSuccessResult = () => ({ stdout: readFixture("chatEnvelope.json"), stderr: "", exitCode: 0 });

const buildEnvNames = () => {
  const entries = readFileSync("/proc/self/environ", "utf8").split("\0").filter((entry) => entry !== "");
  return entries.map((entry) => entry.split("=")[0]).sort();
};

const handlers = {
  "success": () => buildSuccessResult(),
  "error": () => ({ stdout: readFixture("errorEnvelope.json"), stderr: "", exitCode: 1 }),
  "no-session": () => ({ stdout: readFixture("noSession.txt"), stderr: "", exitCode: 1 }),
  "invalid": () => ({ stdout: "this is not json", stderr: "", exitCode: 0 }),
  "slow": () => {
    setInterval(keepAlive, KEEP_ALIVE_MS);
    return { stdout: "", stderr: `fake-agy-pid=${process.pid}\n`, exitCode: 0 };
  },
  "write-file": () => {
    const outputPath = join(process.cwd(), OUTPUT_FILE_NAME);
    writeFileSync(outputPath, "FAKE-PNG");
    return buildSuccessResult();
  },
  "echo": (prompt) => {
    const envelope = readChatEnvelope();
    return { stdout: JSON.stringify({ ...envelope, response: prompt }), stderr: "", exitCode: 0 };
  },
  "env": () => {
    const envelope = readChatEnvelope();
    const names = JSON.stringify(buildEnvNames());
    return { stdout: JSON.stringify({ ...envelope, response: names }), stderr: "", exitCode: 0 };
  },
  "stderr-secret": () => ({ stdout: "", stderr: "token sk-fake-secret-123 rejected\n", exitCode: 1 }),
};

const args = process.argv.slice(ARGUMENTS_OFFSET);
const promptIndex = args.indexOf("-p") + 1;
const prompt = args[promptIndex] ?? "";
const mode = MODE_MARKER.exec(prompt)?.[1] ?? "success";
const handler = handlers[mode];
const result = handler === undefined ? { stdout: "", stderr: `unknown fake mode ${mode}\n`, exitCode: 2 } : handler(prompt);

process.stdout.write(result.stdout.endsWith("\n") || result.stdout === "" ? result.stdout : `${result.stdout}\n`);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
