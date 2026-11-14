import { describe, expect, it } from "vitest";
import { BrowseUrlUtil } from "@antigravity-connector/mcp/Utils/BrowseUrlUtil.ts";

describe("BrowseUrlUtil.isAllowed", () => {
  it.each([
    "https://example.com/a",
    "http://93.184.216.34/",
    "https://[2606:2800:220:1:248:1893:25c8:1946]/",
  ])("allows the public address %s", (url) => {
    expect(BrowseUrlUtil.isAllowed(url)).toBe(true);
  });

  it.each([
    "file:///etc/passwd",
    "chrome://settings",
    "about:blank",
    "data:text/html,hi",
    "javascript:alert(1)",
    "http://127.0.0.1:8787/health",
    "http://localhost:3000/",
    "http://app.localhost/",
    "http://192.168.0.1/",
    "http://10.0.0.5/",
    "http://172.20.0.1/",
    "http://169.254.169.254/latest",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]:8787/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "https://user:pass@example.com/",
    "not a url",
  ])("refuses %s", (url) => {
    expect(BrowseUrlUtil.isAllowed(url)).toBe(false);
  });
});
