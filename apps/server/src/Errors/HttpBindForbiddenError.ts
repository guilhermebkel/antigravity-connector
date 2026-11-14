export class HttpBindForbiddenError extends Error {
  readonly host: string;

  constructor(host: string) {
    super(
      `HOST=${host} is not a loopback address. Keep HOST=127.0.0.1, or set ALLOW_NON_LOOPBACK_BIND=true only when `
      + "the port is published on 127.0.0.1 alone (for example \"127.0.0.1:8787:8787\").",
    );
    this.name = "HttpBindForbiddenError";
    this.host = host;
  }
}
