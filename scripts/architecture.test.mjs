import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SCOPE = "@antigravity-connector/";
const PACKAGE_DIRS = ["apps/server", "packages/api", "packages/mcp", "packages/agy", "packages/core", "packages/protocol", "packages/tooling"];
const AGY_PACKAGE = `${SCOPE}agy`;
const WORKSPACE = "workspace:*";
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

// Why: this is the dependency direction from the project brief; the matching lint rule (local/package-boundaries) checks imports, this test checks package.json.
const ALLOWED_DEPENDENCIES = {
  protocol: [],
  agy: ["protocol"],
  core: ["protocol", "agy"],
  api: ["core", "protocol"],
  mcp: ["core", "protocol"],
  server: ["api", "mcp", "core", "protocol"],
  tooling: [],
};

const readWorkspaceDependencies = (manifest) => {
  const names = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {}));
  return names.filter((name) => name.startsWith(SCOPE)).map((name) => name.slice(SCOPE.length));
};

const DOORS = new Set(["api", "mcp"]);

const describeViolation = (own, target) => {
  const isAgyFromDoor = DOORS.has(own) && target === "agy";
  return isAgyFromDoor ? `${own} must not depend on ${AGY_PACKAGE}: only core talks to agy` : `${own} must not depend on ${SCOPE}${target}`;
};

const listViolations = (manifests) => {
  const violations = [];
  for (const [own, manifest] of Object.entries(manifests)) {
    const allowed = ALLOWED_DEPENDENCIES[own] ?? [];
    const forbidden = readWorkspaceDependencies(manifest).filter((target) => target !== "tooling" && !allowed.includes(target));
    const messages = forbidden.map((target) => describeViolation(own, target));
    violations.push(...messages);
  }
  return violations;
};

const readManifest = (dir) => {
  const manifestPath = join(ROOT, dir, "package.json");
  const text = readFileSync(manifestPath, "utf8");
  return JSON.parse(text);
};

const readRealManifests = () => {
  const entries = PACKAGE_DIRS.map((dir) => [dir.split("/")[1], readManifest(dir)]);
  return Object.fromEntries(entries);
};

describe("package dependencies follow the brief", () => {
  it("the real package.json files break no rule", () => {
    const manifests = readRealManifests();

    expect(listViolations(manifests)).toStrictEqual([]);
  });

  it("the api package does not list agy", () => {
    const manifests = { api: { dependencies: { [AGY_PACKAGE]: WORKSPACE } } };

    expect(listViolations(manifests)).toStrictEqual([`api must not depend on ${AGY_PACKAGE}: only core talks to agy`]);
  });

  it("the mcp package does not list agy, even as a dev dependency", () => {
    const manifests = { mcp: { devDependencies: { [AGY_PACKAGE]: WORKSPACE } } };

    expect(listViolations(manifests)).toStrictEqual([`mcp must not depend on ${AGY_PACKAGE}: only core talks to agy`]);
  });

  it("the two doors do not depend on each other", () => {
    const manifests = {
      api: { dependencies: { [`${SCOPE}mcp`]: WORKSPACE } },
      mcp: { dependencies: { [`${SCOPE}api`]: WORKSPACE } },
    };

    expect(listViolations(manifests)).toStrictEqual([`api must not depend on ${SCOPE}mcp`, `mcp must not depend on ${SCOPE}api`]);
  });

  it("the protocol depends on no workspace package, and agy only on the protocol", () => {
    const manifests = {
      protocol: { dependencies: { [`${SCOPE}core`]: WORKSPACE } },
      agy: { dependencies: { [`${SCOPE}protocol`]: WORKSPACE, [`${SCOPE}core`]: WORKSPACE } },
    };

    expect(listViolations(manifests)).toStrictEqual([`protocol must not depend on ${SCOPE}core`, `agy must not depend on ${SCOPE}core`]);
  });

  it("allowed dependencies and the tooling package pass", () => {
    const manifests = {
      core: { dependencies: { [`${SCOPE}agy`]: WORKSPACE, [`${SCOPE}protocol`]: WORKSPACE } },
      server: { dependencies: { [`${SCOPE}api`]: WORKSPACE, [`${SCOPE}mcp`]: WORKSPACE }, devDependencies: { [`${SCOPE}tooling`]: WORKSPACE } },
    };

    expect(listViolations(manifests)).toStrictEqual([]);
  });
});
