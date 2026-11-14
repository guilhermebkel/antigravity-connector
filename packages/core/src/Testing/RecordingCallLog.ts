import type { CallLogPort, CallRecord } from "@antigravity-connector/core/Protocols/CallLogProtocol.ts";

export class RecordingCallLog implements CallLogPort {
  readonly records: CallRecord[] = [];

  write(record: CallRecord): void {
    this.records.push(record);
  }
}
