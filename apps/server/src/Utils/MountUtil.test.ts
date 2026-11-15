import { describe, expect, it } from "vitest";
import { MountUtil } from "@antigravity-connector/server/Utils/MountUtil.ts";

const MOUNT_INFO = [
  "36 25 0:32 / / rw,relatime - overlay overlay rw",
  "41 36 8:1 /var/lib/caprover/agy-login /home/agy/agy-login rw,relatime - ext4 /dev/sda1 rw",
  "42 36 8:1 /var/lib/caprover/agy-data /data rw,relatime - ext4 /dev/sda1 rw",
].join("\n");

describe("MountUtil", () => {
  it("reads the mount point of every line of mountinfo", () => {
    expect(MountUtil.readMountPoints(MOUNT_INFO)).toStrictEqual(["/", "/home/agy/agy-login", "/data"]);
  });

  it("finds a directory that is a mount point, and a mount point under a directory", () => {
    const points = MountUtil.readMountPoints(MOUNT_INFO);

    expect(MountUtil.isMountedAt(points, "/data")).toBe(true);
    expect(MountUtil.isMountedAt(points, "/home/agy")).toBe(false);
    expect(MountUtil.isMountedUnder(points, "/home/agy")).toBe(true);
    expect(MountUtil.isMountedUnder(points, "/var")).toBe(false);
  });

  it("a directory is not mounted under itself: the root line does not count", () => {
    expect(MountUtil.isMountedUnder(["/"], "/")).toBe(false);
  });
});
