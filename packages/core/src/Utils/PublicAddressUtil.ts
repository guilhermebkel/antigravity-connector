import { BlockList, isIP } from "node:net";

type BlockedRange = {
  network: string;
  prefixLength: number;
};

const IPV4_PUBLIC_FAMILY = "ipv4";
const IPV6_PUBLIC_FAMILY = "ipv6";
const IPV4_VERSION = 4;

export class PublicAddressUtil {
  static readonly BLOCKED_IPV4: readonly BlockedRange[] = [
    { network: "0.0.0.0", prefixLength: 8 },
    { network: "10.0.0.0", prefixLength: 8 },
    { network: "100.64.0.0", prefixLength: 10 },
    { network: "127.0.0.0", prefixLength: 8 },
    { network: "169.254.0.0", prefixLength: 16 },
    { network: "172.16.0.0", prefixLength: 12 },
    { network: "192.0.0.0", prefixLength: 24 },
    { network: "192.0.2.0", prefixLength: 24 },
    { network: "192.88.99.0", prefixLength: 24 },
    { network: "192.168.0.0", prefixLength: 16 },
    { network: "198.18.0.0", prefixLength: 15 },
    { network: "198.51.100.0", prefixLength: 24 },
    { network: "203.0.113.0", prefixLength: 24 },
    { network: "224.0.0.0", prefixLength: 4 },
    { network: "240.0.0.0", prefixLength: 4 },
  ];

  static readonly BLOCKED_IPV6: readonly BlockedRange[] = [
    { network: "::", prefixLength: 128 },
    { network: "::1", prefixLength: 128 },
    { network: "64:ff9b::", prefixLength: 96 },
    { network: "100::", prefixLength: 64 },
    { network: "2001::", prefixLength: 32 },
    { network: "2001:db8::", prefixLength: 32 },
    { network: "2002::", prefixLength: 16 },
    { network: "fc00::", prefixLength: 7 },
    { network: "fe80::", prefixLength: 10 },
    { network: "ff00::", prefixLength: 8 },
  ];

  static readonly BLOCK_LIST: BlockList = PublicAddressUtil.buildBlockList();

  static buildBlockList(): BlockList {
    const list = new BlockList();
    PublicAddressUtil.BLOCKED_IPV4.forEach((range) => {
      list.addSubnet(range.network, range.prefixLength, IPV4_PUBLIC_FAMILY);
    });
    PublicAddressUtil.BLOCKED_IPV6.forEach((range) => {
      list.addSubnet(range.network, range.prefixLength, IPV6_PUBLIC_FAMILY);
    });
    return list;
  }

  static isPublic(address: string): boolean {
    const bare = address.replace(/^\[|\]$/g, "");
    const version = isIP(bare);
    if (version === 0) {
      return false;
    }
    const family = version === IPV4_VERSION ? IPV4_PUBLIC_FAMILY : IPV6_PUBLIC_FAMILY;
    return !PublicAddressUtil.BLOCK_LIST.check(bare, family);
  }
}
