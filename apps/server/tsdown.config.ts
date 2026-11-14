import { defineConfig } from "tsdown";

// Why: the server ships as one bundle, so the workspace packages are inlined and only the npm dependencies stay external.
export default defineConfig({
  entry: ["src/main.ts"],
  format: "esm",
  platform: "node",
  outDir: "dist",
  clean: true,
  deps: { alwaysBundle: [/^@antigravity-connector\//] },
});
