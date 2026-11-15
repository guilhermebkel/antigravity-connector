import { readFileSync } from "node:fs";

export class MountUtil {
  static readonly MOUNT_INFO_PATH = "/proc/self/mountinfo";

  static readonly MOUNT_POINT_FIELD_INDEX = 4;

  static readonly FIELD_SEPARATOR = " ";

  static readonly LINE_SEPARATOR = "\n";

  static readMountPoints(mountInfoText: string): string[] {
    return mountInfoText
      .split(MountUtil.LINE_SEPARATOR)
      .filter((line) => line.length > 0)
      .map((line) => line.split(MountUtil.FIELD_SEPARATOR)[MountUtil.MOUNT_POINT_FIELD_INDEX])
      .filter((mountPoint): mountPoint is string => mountPoint !== undefined);
  }

  static readProcessMountPoints(): string[] | undefined {
    try {
      return MountUtil.readMountPoints(readFileSync(MountUtil.MOUNT_INFO_PATH, "utf8"));
    } catch {
      return undefined;
    }
  }

  static isMountedAt(mountPoints: readonly string[], directory: string): boolean {
    return mountPoints.includes(directory);
  }

  static isMountedUnder(mountPoints: readonly string[], directory: string): boolean {
    return mountPoints.some((mountPoint) => mountPoint !== directory && mountPoint.startsWith(`${directory}/`));
  }
}
