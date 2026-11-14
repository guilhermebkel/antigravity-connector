import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const WORK_DIR = mkdtempSync(join(ROOT, "lint-fixtures-"));
const MINUTE_MS = 60_000;
const CONFIG_FILE = ".oxlintrc.json";
const LOCAL_PLUGIN = "./packages/tooling/eslint-local-rules.mjs";
const RESTRICTED_IMPORT = "eslint(no-restricted-imports)";
const SERVICE_FILE = "packages/core/src/Services/QueueService.ts";
const API_FILE = "packages/api/src/Routes/ChatCompletionRoute.ts";
const MCP_FILE = "packages/mcp/src/Tools/WebSearchTool.ts";
const AGY_FILE = "packages/agy/src/Adapters/AgyRunAdapter.ts";
const NO_CHILD_PROCESS = "local(no-child-process-outside-agy)";
const PACKAGE_BOUNDARIES = "local(package-boundaries)";
const GEMINI_DIR = [".", "gemini"].join("");

const writeConfig = () => {
  const configText = readFileSync(join(ROOT, CONFIG_FILE), "utf8");
  const config = JSON.parse(configText);
  const localPluginPath = join(ROOT, LOCAL_PLUGIN);
  // Why: the fixtures sit in a throwaway folder inside the repo (so the JS plugins resolve) and are deleted after the run; the config copy needs the local plugin path made absolute.
  config.jsPlugins = config.jsPlugins.map((plugin) => plugin === LOCAL_PLUGIN ? localPluginPath : plugin);
  writeFileSync(join(WORK_DIR, CONFIG_FILE), JSON.stringify(config));
};

const writeFixture = (path, code) => {
  const file = join(WORK_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);
};

const runOxlint = (path) => {
  const configPath = join(WORK_DIR, CONFIG_FILE);
  const filePath = join(WORK_DIR, path);
  // Why: `--silent` suppresses pnpm engine/update notices on stdout so `result.stdout` stays valid JSON.
  const args = ["--silent", "exec", "oxlint", "--type-aware", "-c", configPath, "--format", "json", filePath];
  const result = spawnSync("pnpm", args, { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" });
  const report = JSON.parse(result.stdout);
  return report.diagnostics.map((diagnostic) => diagnostic.code);
};

writeConfig();
afterAll(() => {
  rmSync(WORK_DIR, { recursive: true, force: true });
});

// Why: each row is a file that breaks one rule from the project brief (who may spawn, who may import whom, no credentials path, env only in EnvUtil, file suffix), the path it sits at, and the rule id Oxlint names.
const FAILING_EXAMPLES = [
  ["the api package spawning a process", API_FILE, "import { spawn } from \"node:child_process\";\nexport const run = spawn;\n", NO_CHILD_PROCESS],
  ["the core package importing child_process", SERVICE_FILE, "import { exec } from \"child_process\";\nexport const run = exec;\n", NO_CHILD_PROCESS],
  ["a string with the credentials folder", SERVICE_FILE, `export const folder = "~/${GEMINI_DIR}/antigravity-cli";\n`, "local(no-gemini-path)"],
  ["the mcp package importing agy", MCP_FILE, "import { runAgy } from \"@antigravity-connector/agy\";\nexport const make = runAgy;\n", PACKAGE_BOUNDARIES],
  ["the mcp package importing the api package", MCP_FILE, "import { api } from \"@antigravity-connector/api\";\nexport const make = api;\n", PACKAGE_BOUNDARIES],
  ["a deep import into another package", API_FILE, "import { QueueService } from \"@antigravity-connector/core/Services/QueueService.ts\";\nexport const make = QueueService;\n", PACKAGE_BOUNDARIES],
  ["process.env outside EnvUtil", SERVICE_FILE, "export const key = process.env.API_KEY;\n", "local(no-process-env)"],
  ["a file whose name lacks the folder suffix", "packages/core/src/Services/Queue.ts", "export const ONE = 1;\n", "local(file-suffix)"],
  ["a relative parent import", SERVICE_FILE, "import { Other } from \"../Utils/OtherUtil.ts\";\nexport const make = Other;\n", RESTRICTED_IMPORT],
  ["a relative import in the same folder", SERVICE_FILE, "import { Other } from \"./OtherService.ts\";\nexport const make = Other;\n", RESTRICTED_IMPORT],
  ["console in production code", SERVICE_FILE, "export const log = () => { console.log(\"x\"); };\n", "eslint(no-console)"],
  ["a vitest matcher that asserts nothing exact", "packages/core/src/Utils/EnvUtil.test.ts", "import { expect, it } from \"vitest\";\nit(\"a\", () => { expect(1).toBeTruthy(); });\n", "vitest(no-restricted-matchers)"],
  ["a floating promise", SERVICE_FILE, "export const run = async () => { Promise.resolve(1); };\n", "typescript(no-floating-promises)"],
];

describe("pnpm lint, Oxlint side", () => {
  it.each(FAILING_EXAMPLES)("%s fails with the name of the rule", (_name, path, code, ruleId) => {
    writeFixture(path, code);
    const codes = runOxlint(path);
    expect(codes).toContain(ruleId);
  }, MINUTE_MS);

  it("the agy package may spawn a process", () => {
    writeFixture(AGY_FILE, "import { spawn } from \"node:child_process\";\nexport const run = spawn;\n");
    const codes = runOxlint(AGY_FILE);
    expect(codes).not.toContain(NO_CHILD_PROCESS);
  }, MINUTE_MS);

  it("EnvUtil may read process.env", () => {
    writeFixture("packages/core/src/Utils/EnvUtil.ts", "export const readEnv = () => process.env;\n");
    const codes = runOxlint("packages/core/src/Utils/EnvUtil.ts");
    expect(codes).not.toContain("local(no-process-env)");
  }, MINUTE_MS);

  it("a clean file passes", () => {
    writeFixture("packages/core/src/Services/CleanService.ts", "export const ONE = 1;\n");
    const codes = runOxlint("packages/core/src/Services/CleanService.ts");
    expect(codes).toStrictEqual([]);
  }, MINUTE_MS);
});

const eslint = new ESLint({ cwd: ROOT });
const ESLINT_FILE = "packages/core/src/index.ts";

const runEslint = async (path, code) => {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, path) });
  return result.messages.map((message) => message.ruleId);
};

// Why: each row is a rule Oxlint cannot run (or runs differently), so ESLint keeps it and `pnpm lint` fails if either linter fails.
const ESLINT_EXAMPLES = [
  ["a boolean named without a prefix", ESLINT_FILE, "export const done = true;\nexport const check = (ready: boolean) => ready;\n", "@typescript-eslint/naming-convention"],
  ["a call nested three deep", ESLINT_FILE, "export const run = () => a(b(1, 2, 3), 2, 3);\n", "no-restricted-syntax"],
  ["a one-letter name", ESLINT_FILE, "export const run = (x: string) => x;\n", "id-length"],
];

describe("pnpm lint, ESLint side", () => {
  it.each(ESLINT_EXAMPLES)("%s fails with the name of the rule", async (_name, path, code, ruleId) => {
    const ruleIds = await runEslint(path, code);
    expect(ruleIds).toContain(ruleId);
  }, MINUTE_MS);
});
