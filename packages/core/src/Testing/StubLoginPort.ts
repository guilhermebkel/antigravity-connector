import type { AgyLoginBeginResult, AgyLoginPort, AgyLoginSubmitResult } from "@antigravity-connector/agy";

export class StubLoginPort implements AgyLoginPort {
  static readonly LOGIN_URL = "https://accounts.google.com/o/oauth2/auth?stub=1";

  static readonly GOOD_CODE = "stub-good-code";

  private readonly isLoggedIn: () => boolean;

  private readonly onConnected: () => void;

  private isOpen = false;

  constructor(isLoggedIn: () => boolean, onConnected: () => void) {
    this.isLoggedIn = isLoggedIn;
    this.onConnected = onConnected;
  }

  start(): Promise<AgyLoginBeginResult> {
    if (this.isLoggedIn()) {
      return Promise.resolve({ kind: "connected" });
    }
    this.isOpen = true;
    return Promise.resolve({ kind: "started", loginUrl: StubLoginPort.LOGIN_URL });
  }

  submit(code: string): Promise<AgyLoginSubmitResult> {
    if (!this.isOpen) {
      return Promise.resolve({ kind: "no_attempt" });
    }
    this.isOpen = false;
    if (code !== StubLoginPort.GOOD_CODE) {
      return Promise.resolve({ kind: "rejected" });
    }
    this.onConnected();
    return Promise.resolve({ kind: "connected" });
  }

  stop(): void {
    this.isOpen = false;
  }
}
