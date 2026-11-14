#!/usr/bin/env node
// Acceptance measurement (issue #21, S2): generateText and streamText through the AI SDK provider against the real server.
// Reads API_BASE_URL and API_KEY from the environment; prints one JSON line per measurement.
import { generateText, streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "node:process";

const PROMPT = "Reply with the word ok.";
const MODELS = ["gemini-4-argon", "gemini-3.8-flash"];
const RUNS_PER_MODEL = 2;
const MS_PER_SECOND = 1000;

const readRequired = (name) => {
  const value = env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
};

const provider = createOpenAICompatible({
  name: "antigravity-connector",
  baseURL: `${readRequired("API_BASE_URL")}/v1`,
  apiKey: readRequired("API_KEY"),
  includeUsage: true,
});

const measureGenerate = async (modelId) => {
  const startedAt = performance.now();
  const result = await generateText({ model: provider(modelId), prompt: PROMPT });
  const totalMs = performance.now() - startedAt;
  return { mode: "generateText", modelId, totalSeconds: totalMs / MS_PER_SECOND, totalTokens: result.usage.totalTokens, text: result.text.trim() };
};

const measureStream = async (modelId) => {
  const startedAt = performance.now();
  const result = streamText({ model: provider(modelId), prompt: PROMPT });
  let firstTokenMs;
  for await (const _chunk of result.textStream) {
    firstTokenMs ??= performance.now() - startedAt;
  }
  const totalMs = performance.now() - startedAt;
  const usage = await result.usage;
  return {
    mode: "streamText",
    modelId,
    firstTokenSeconds: (firstTokenMs ?? totalMs) / MS_PER_SECOND,
    totalSeconds: totalMs / MS_PER_SECOND,
    totalTokens: usage.totalTokens,
    text: (await result.text).trim(),
  };
};

for (const modelId of MODELS) {
  for (let run = 1; run <= RUNS_PER_MODEL; run += 1) {
    const generated = await measureGenerate(modelId);
    process.stdout.write(`${JSON.stringify({ run, ...generated })}\n`);
    const streamed = await measureStream(modelId);
    process.stdout.write(`${JSON.stringify({ run, ...streamed })}\n`);
  }
}
