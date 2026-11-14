import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const DOCKERFILE = "apps/server/Dockerfile";
const read = (relativePath) => readFileSync(join(ROOT, relativePath), "utf8");

describe("the container files", () => {
  it("AC3: the app port is not published, only Caddy publishes 443, and the volume holds no secret", () => {
    const compose = read("docker-compose.yml");
    expect(compose).not.toMatch(/"127\.0\.0\.1:8787:8787"|"8787:8787"/);
    expect(compose).toMatch(/"443:443"/);
    expect(read("deploy/Caddyfile")).toMatch(/reverse_proxy antigravity-connector:8787/);
    expect(compose).toMatch(/- agy-gemini:\/home\/agy\/\.gemini/);
    expect(compose).not.toMatch(/API_KEY|token|secret/i);
  });

  it("AC4: the image runs as the agy user and the build context keeps .env and token files out", () => {
    const dockerfile = read(DOCKERFILE);
    expect(dockerfile).toMatch(/^USER agy$/m);
    expect(dockerfile).not.toMatch(/^USER root$/m);
    const dockerignore = read(".dockerignore").split("\n");
    expect(dockerignore).toContain(".env");
    expect(dockerignore).toContain(".env.*");
  });

  it("the server bind settings in the image and the example file are the ones the bind guard needs", () => {
    const dockerfile = read(DOCKERFILE);
    expect(dockerfile).toMatch(/HOST=0\.0\.0\.0/);
    expect(dockerfile).toMatch(/ALLOW_NON_LOOPBACK_BIND=true/);
    expect(read(".env.example")).toMatch(/^API_KEY=/m);
  });

  it("the agy binary is pinned by a SHA-512 that the build checks", () => {
    const dockerfile = read(DOCKERFILE);
    expect(dockerfile).toMatch(/AGY_SHA512=[0-9a-f]{128}/);
    expect(dockerfile).toMatch(/sha512sum -c -/);
  });
});
