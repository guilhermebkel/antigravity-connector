import { describe, expect, it } from "vitest";
import { NetworkBindUtil } from "@antigravity-connector/server/Utils/NetworkBindUtil.ts";

describe("NetworkBindUtil", () => {
  it("accepts loopback hosts without the override", () => {
    expect(() => {
      NetworkBindUtil.assertBindAllowed("127.0.0.1", false);
    }).not.toThrow();
    expect(() => {
      NetworkBindUtil.assertBindAllowed("::1", false);
    }).not.toThrow();
    expect(() => {
      NetworkBindUtil.assertBindAllowed("localhost", false);
    }).not.toThrow();
  });

  it("refuses 0.0.0.0 without the override, with the message that names the port rule", () => {
    expect(() => {
      NetworkBindUtil.assertBindAllowed("0.0.0.0", false);
    }).toThrow(/127\.0\.0\.1:8787:8787/);
  });

  it("accepts a non-loopback host when the override is set", () => {
    expect(() => {
      NetworkBindUtil.assertBindAllowed("0.0.0.0", true);
    }).not.toThrow();
  });
});
