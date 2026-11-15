#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { env } from "node:process";
import { join } from "node:path";

const LOGIN_MARKER = "fake-login-done";
const GOOD_CODE = "FAKE-GOOD-CODE";
const DEFAULT_WINDOW_MS = 60000;
const WINDOW_MS = Number(env.FAKE_LOGIN_WINDOW_MS ?? DEFAULT_WINDOW_MS);
const LOGIN_LINK = "https://accounts.google.com/o/oauth2/auth?fake=1&state=fake-state";
const markerPath = join(env.HOME ?? ".", LOGIN_MARKER);
const successOutput = readFileSync(new URL("./fixtures/chatEnvelope.json", import.meta.url), "utf8");

const finish = (stdout, exitCode) => {
  process.stdout.write(stdout);
  process.exit(exitCode);
};

if (existsSync(markerPath)) {
  finish(successOutput, 0);
}

process.stderr.write(`Authentication required. Please visit the URL to log in:\n  ${LOGIN_LINK}\n\n`);
process.stderr.write("Waiting for authentication (timeout 60s)...\nOr, paste the authorization code here and press Enter:\n");

let received = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  received += chunk;
  if (!received.includes("\n")) {
    return;
  }
  const code = received.split("\n")[0].trim();
  if (code === GOOD_CODE) {
    writeFileSync(markerPath, "ok");
    finish(successOutput, 0);
  }
  finish(JSON.stringify({ status: "ERROR", error: "invalid authorization code" }), 1);
});
setTimeout(() => {
  finish(JSON.stringify({ status: "ERROR", error: "authentication failed or timed out" }), 1);
}, WINDOW_MS);
