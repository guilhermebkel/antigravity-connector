import { BlockList, isIP } from "node:net";

type BlockedSubnet
  = "0.0.0.0/8"
    | "10.0.0.0/8"
    | "100.64.0.0/10"
    | "127.0.0.0/8"
    | "169.254.0.0/16"
    | "172.16.0.0/12"
    | "192.168.0.0/16"
    | "::/128"
    | "::1/128"
    | "fc00::/7"
    | "fe80::/10";

export class BrowseUrlUtil {
  static readonly ALLOWED_PROTOCOLS: readonly ("http:" | "https:")[] = ["http:", "https:"];

  static readonly BLOCKED_SUBNETS: readonly BlockedSubnet[] = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "::/128",
    "::1/128",
    "fc00::/7",
    "fe80::/10",
  ];

  static readonly IPV4_FAMILY = "ipv4";

  static readonly IPV6_FAMILY = "ipv6";

  static readonly BLOCK_LIST = BrowseUrlUtil.buildBlockList();

  static readonly IPV4_VERSION = 4;

  static readonly NO_IP_VERSION = 0;

  static readonly BRACKETS_PATTERN = /^\[|\]$/g;

  static readonly LOCALHOST_NAME = "localhost";

  static readonly LOCALHOST_SUFFIX = ".localhost";

  static readonly MAPPED_IPV4_PREFIX = "::ffff:";

  static isAllowed(url: string): boolean {
    const parsed = BrowseUrlUtil.parseUrl(url);
    if (parsed === undefined) {
      return false;
    }
    if (!BrowseUrlUtil.isAllowedProtocol(parsed.protocol)) {
      return false;
    }
    if (parsed.username !== "" || parsed.password !== "") {
      return false;
    }
    return !BrowseUrlUtil.isBlockedHost(parsed.hostname);
  }

  static isAllowedProtocol(protocol: string): boolean {
    return BrowseUrlUtil.ALLOWED_PROTOCOLS.some((allowed) => allowed === protocol);
  }

  static parseUrl(url: string): URL | undefined {
    try {
      return new URL(url);
    } catch {
      return undefined;
    }
  }

  static isBlockedHost(hostname: string): boolean {
    const host = hostname.replace(BrowseUrlUtil.BRACKETS_PATTERN, "").toLowerCase();
    if (host === BrowseUrlUtil.LOCALHOST_NAME || host.endsWith(BrowseUrlUtil.LOCALHOST_SUFFIX)) {
      return true;
    }
    if (host.startsWith(BrowseUrlUtil.MAPPED_IPV4_PREFIX)) {
      return true;
    }
    const version = isIP(host);
    if (version === BrowseUrlUtil.NO_IP_VERSION) {
      return false;
    }
    const family = version === BrowseUrlUtil.IPV4_VERSION ? BrowseUrlUtil.IPV4_FAMILY : BrowseUrlUtil.IPV6_FAMILY;
    return BrowseUrlUtil.BLOCK_LIST.check(host, family);
  }

  static buildBlockList(): BlockList {
    const blockList = new BlockList();
    for (const subnet of BrowseUrlUtil.BLOCKED_SUBNETS) {
      const [network = "", prefixText = ""] = subnet.split("/");
      const family = network.includes(":") ? BrowseUrlUtil.IPV6_FAMILY : BrowseUrlUtil.IPV4_FAMILY;
      blockList.addSubnet(network, Number(prefixText), family);
    }
    return blockList;
  }
}
