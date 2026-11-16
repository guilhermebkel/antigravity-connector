import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { HttpsImageDownloadAdapter } from "@antigravity-connector/core/Adapters/HttpsImageDownloadAdapter.ts";
import { RemoteImageError } from "@antigravity-connector/core/Errors/RemoteImageError.ts";
import { ImageInputUtil } from "@antigravity-connector/core/Utils/ImageInputUtil.ts";
import { TlsFixtureUtil } from "@antigravity-connector/core/Testing/TlsFixtureUtil.ts";

const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d", "hex");
const SHORT_TIMEOUT_MS = 150;
const FAKE_SECRET = "secret-token-9f31c2";

type Handler = Parameters<typeof createServer>[1];

type Fixture = {
  server: Server;
  port: number;
  connections: { count: number };
};

const servers: Server[] = [];

const startServer = async (handler: Handler): Promise<Fixture> => {
  const connections = { count: 0 };
  const server = createServer({ key: TlsFixtureUtil.PRIVATE_KEY, cert: TlsFixtureUtil.CERTIFICATE }, handler);
  server.on("secureConnection", () => {
    connections.count += 1;
  });
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  servers.push(server);
  return { port: (server.address() as AddressInfo).port, server, connections };
};

const buildAdapter = (timeoutMs?: number): HttpsImageDownloadAdapter => new HttpsImageDownloadAdapter({
  timeoutMs,
  isPublicAddress: () => true,
  ca: TlsFixtureUtil.CERTIFICATE,
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => {
      resolve();
    });
  })));
});

describe("HttpsImageDownloadAdapter", () => {
  it("returns the bytes of an image served over https", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(PNG_BYTES);
    });
    const bytes = await buildAdapter().download(new URL(`https://localhost:${port}/photo.png`));
    expect([...bytes]).toStrictEqual([...PNG_BYTES]);
  });

  it("refuses a host that resolves to a loopback address, and no connection is opened", async () => {
    const { port, connections } = await startServer((_request, response) => {
      response.end(PNG_BYTES);
    });
    const guarded = new HttpsImageDownloadAdapter({ ca: TlsFixtureUtil.CERTIFICATE });
    await expect(guarded.download(new URL(`https://localhost:${port}/photo.png`))).rejects.toMatchObject({
      reason: "non_public_address",
    });
    expect(connections.count).toBe(0);
  });

  it.each([
    ["127.0.0.1"],
    ["[::1]"],
    ["10.1.2.3"],
    ["169.254.169.254"],
    ["[::ffff:127.0.0.1]"],
  ])("refuses the address %s written in the URL, before any lookup", async (host) => {
    const guarded = new HttpsImageDownloadAdapter({ ca: TlsFixtureUtil.CERTIFICATE });
    await expect(guarded.download(new URL(`https://${host}:9/photo.png`))).rejects.toMatchObject({
      reason: "non_public_address",
    });
  });

  it("does not follow a redirect, and the target is never asked", async () => {
    const target = await startServer((_request, response) => {
      response.end(PNG_BYTES);
    });
    const { port } = await startServer((_request, response) => {
      response.writeHead(302, { location: `https://localhost:${target.port}/photo.png` });
      response.end();
    });
    await expect(buildAdapter().download(new URL(`https://localhost:${port}/a`))).rejects.toMatchObject({ reason: "redirect" });
    expect(target.connections.count).toBe(0);
  });

  it("refuses an error status", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(404);
      response.end("missing");
    });
    await expect(buildAdapter().download(new URL(`https://localhost:${port}/a`))).rejects.toMatchObject({ reason: "bad_status" });
  });

  it("refuses a body that declares more than 4 MiB", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200, { "content-length": String(ImageInputUtil.MAX_IMAGE_BYTES + 1) });
      response.end(PNG_BYTES);
    });
    await expect(buildAdapter().download(new URL(`https://localhost:${port}/a`))).rejects.toMatchObject({ reason: "too_large" });
  });

  it("stops a body over 4 MiB that does not declare its size", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200);
      response.write(Buffer.alloc(ImageInputUtil.MAX_IMAGE_BYTES));
      response.end(Buffer.alloc(ImageInputUtil.MAX_IMAGE_BYTES));
    });
    await expect(buildAdapter().download(new URL(`https://localhost:${port}/a`))).rejects.toMatchObject({ reason: "too_large" });
  });

  it("accepts a body of exactly 4 MiB", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200);
      response.end(Buffer.alloc(ImageInputUtil.MAX_IMAGE_BYTES));
    });
    const bytes = await buildAdapter().download(new URL(`https://localhost:${port}/a`));
    expect(bytes.byteLength).toBe(ImageInputUtil.MAX_IMAGE_BYTES);
  });

  it("gives up on a server that never answers, and the socket is closed", async () => {
    const { port, server } = await startServer(() => undefined);
    await expect(buildAdapter(SHORT_TIMEOUT_MS).download(new URL(`https://localhost:${port}/a`))).rejects.toMatchObject({
      reason: "timeout",
    });
    await expect.poll(() => new Promise<number>((resolve) => {
      server.getConnections((_error, count) => {
        resolve(count);
      });
    })).toBe(0);
  });

  it("gives up on a server that stalls in the middle of the body", async () => {
    const { port } = await startServer((_request, response) => {
      response.writeHead(200);
      response.write(PNG_BYTES);
    });
    await expect(buildAdapter(SHORT_TIMEOUT_MS).download(new URL(`https://localhost:${port}/a`))).rejects.toMatchObject({
      reason: "timeout",
    });
  });

  it("reports a host that is down as unreachable, with nothing from the address in the message", async () => {
    const { port, server } = await startServer((_request, response) => {
      response.end(PNG_BYTES);
    });
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    const failure = await buildAdapter().download(new URL(`https://localhost:${port}/a?token=${FAKE_SECRET}`))
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RemoteImageError);
    expect((failure as RemoteImageError).reason).toBe("unreachable");
    expect((failure as RemoteImageError).message).not.toContain(FAKE_SECRET);
  });

  it("rethrows a cancel from the caller as it is", async () => {
    const { port } = await startServer(() => undefined);
    const controller = new AbortController();
    const pending = buildAdapter().download(new URL(`https://localhost:${port}/a`), controller.signal);
    controller.abort(new Error("client left"));
    await expect(pending).rejects.not.toBeInstanceOf(RemoteImageError);
  });

  it("identifies itself with a User-Agent, as many hosts refuse a request without one, and sends no cookie, authorization or key", async () => {
    let headerNameToValue: Record<string, string | string[] | undefined> = {};
    const { port } = await startServer((request, response) => {
      headerNameToValue = request.headers;
      response.end(PNG_BYTES);
    });
    await buildAdapter().download(new URL(`https://localhost:${port}/a`));
    expect(headerNameToValue["user-agent"]).toBe("antigravity-connector");
    expect(Object.keys(headerNameToValue).sort()).toStrictEqual(["accept", "connection", "host", "user-agent"]);
  });
});
