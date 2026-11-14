import { spawn, type ChildProcess } from "node:child_process";

export class AgySpawnUtil {
  static readonly KILL_SIGNAL = "SIGKILL";

  static readonly NO_SUCH_PROCESS_CODE = "ESRCH";

  static startDetached(
    binaryPath: string,
    args: readonly string[],
    workingDirectory: string,
    childEnvNameToValue: Readonly<Record<string, string>>,
  ): ChildProcess {
    return spawn(binaryPath, args, {
      cwd: workingDirectory,
      env: childEnvNameToValue,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
  }

  static stopProcessGroup(pid: number | undefined): void {
    if (pid === undefined) {
      return;
    }
    try {
      process.kill(-pid, AgySpawnUtil.KILL_SIGNAL);
    } catch (error) {
      const isAlreadyGone
        = error instanceof Error && "code" in error && error.code === AgySpawnUtil.NO_SUCH_PROCESS_CODE;
      if (!isAlreadyGone) {
        throw error;
      }
    }
  }
}
