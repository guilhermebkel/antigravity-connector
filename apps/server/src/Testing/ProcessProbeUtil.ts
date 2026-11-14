import { readdirSync, readFileSync } from "node:fs";

export class ProcessProbeUtil {
  static readonly PROC_DIRECTORY = "/proc";

  static readonly NUL_SEPARATOR = "\0";

  static readonly NUMERIC_PATTERN = /^\d+$/;

  static readonly POLL_MS = 50;

  static readonly POLL_ATTEMPTS = 200;

  static countProcesses(token: string): number {
    return readdirSync(ProcessProbeUtil.PROC_DIRECTORY)
      .filter((entry) => ProcessProbeUtil.NUMERIC_PATTERN.test(entry))
      .map((processId) => ProcessProbeUtil.readCommandLine(processId))
      .filter((commandLine) => commandLine.includes(token))
      .length;
  }

  static async waitUntil(isWanted: (count: number) => boolean, token: string, message: string): Promise<void> {
    for (let attempt = 0; attempt < ProcessProbeUtil.POLL_ATTEMPTS; attempt += 1) {
      if (isWanted(ProcessProbeUtil.countProcesses(token))) {
        return;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ProcessProbeUtil.POLL_MS);
      });
    }
    throw new Error(message);
  }

  static readCommandLine(processId: string): string {
    try {
      const raw = readFileSync(`${ProcessProbeUtil.PROC_DIRECTORY}/${processId}/cmdline`, "utf8");
      return raw.split(ProcessProbeUtil.NUL_SEPARATOR).join(" ");
    } catch {
      return "";
    }
  }
}
