const SOURCE_FILES = "**/*.{ts,tsx,mjs}";
const TYPESCRIPT_FILES = "**/*.{ts,tsx}";

const quote = (files) => {
  // Why: lint-staged passes absolute paths and runs a string command without a shell, so each path is quoted by hand.
  return files.map((file) => JSON.stringify(file)).join(" ");
};

export const buildLintCommand = (files) => {
  // Why: Oxlint and ESLint both run through scripts/lint.mjs; no `--fix`; with `--diff` lint-staged does not re-add fixed files and the working tree must stay as it was.
  return `node scripts/lint.mjs --max-warnings=0 ${quote(files)}`;
};

export const buildRelatedTestsCommand = (files) => {
  // Why: a change nothing imports (a script, a config) has no related test, and that is not a failure.
  return `vitest related --run --passWithNoTests ${quote(files)}`;
};

export const buildTypecheckCommand = () => {
  // Why: `tsc` given file names ignores tsconfig.json, so the typecheck gets none; Turborepo checks every package and skips the ones whose inputs did not change.
  return "pnpm typecheck";
};

export const buildQualityCommand = () => {
  // Why: knip, jscpd and dpdm read the whole project, never a file list, so they stay in the changed run.
  return "pnpm quality";
};

export default {
  [SOURCE_FILES]: [buildLintCommand, buildRelatedTestsCommand, buildQualityCommand],
  [TYPESCRIPT_FILES]: buildTypecheckCommand,
};
