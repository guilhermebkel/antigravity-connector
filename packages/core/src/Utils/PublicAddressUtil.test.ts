import { describe, expect, it } from "vitest";
import { PublicAddressUtil } from "@antigravity-connector/core/Utils/PublicAddressUtil.ts";

describe("PublicAddressUtil", () => {
  it.each([
    ["8.8.8.8"],
    ["1.1.1.1"],
    ["93.184.216.34"],
    ["172.32.0.1"],
    ["100.63.255.255"],
    ["2606:4700:4700::1111"],
    ["2a00:1450:4001:81b::200e"],
  ])("accepts the public address %s", (address) => {
    expect(PublicAddressUtil.isPublic(address)).toBe(true);
  });

  it.each([
    ["127.0.0.1"],
    ["127.255.255.254"],
    ["10.0.0.5"],
    ["172.16.0.1"],
    ["172.31.255.255"],
    ["192.168.1.10"],
    ["169.254.169.254"],
    ["100.64.0.1"],
    ["0.0.0.0"],
    ["224.0.0.1"],
    ["255.255.255.255"],
    ["198.18.0.1"],
    ["::"],
    ["::1"],
    ["fc00::1"],
    ["fd12:3456:789a::1"],
    ["fe80::1"],
    ["ff02::1"],
    ["::ffff:127.0.0.1"],
    ["::ffff:7f00:1"],
    ["::ffff:10.0.0.1"],
    ["64:ff9b::7f00:1"],
    ["2002:7f00:1::1"],
    ["2001:db8::1"],
  ])("refuses the non-public address %s", (address) => {
    expect(PublicAddressUtil.isPublic(address)).toBe(false);
  });

  it.each([
    ["localhost"],
    ["example.com"],
    [""],
    ["999.1.1.1"],
  ])("refuses %j because it is not an IP address", (address) => {
    expect(PublicAddressUtil.isPublic(address)).toBe(false);
  });

  it("reads an IPv6 address written with brackets, as a URL host is", () => {
    expect(PublicAddressUtil.isPublic("[::1]")).toBe(false);
    expect(PublicAddressUtil.isPublic("[2606:4700:4700::1111]")).toBe(true);
  });
});
