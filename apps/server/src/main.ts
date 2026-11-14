import { ServerSetup } from "@antigravity-connector/server/Setup/ServerSetup.ts";

ServerSetup.run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "The server failed to start"}\n`);
  process.exitCode = 1;
});
