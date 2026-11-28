import { describe, expect, it } from "vitest";
import { ImageQuotaError } from "@antigravity-connector/core/Errors/ImageQuotaError.ts";
import { ImageQuotaService } from "@antigravity-connector/core/Services/ImageQuotaService.ts";

const MINUTE = 60000;
const HOUR = 3600000;
const DAY = 86400000;

const buildService = () => {
  const clock = { now: 0 };
  return { clock, service: new ImageQuotaService({ clock: () => clock.now }) };
};

describe("ImageQuotaService", () => {
  it("lets calls through until a quota answer is recorded", () => {
    const { service } = buildService();
    expect(() => {
      service.assertAvailable();
    }).not.toThrow();
  });

  it("refuses until the reset time, and runs again exactly at it", () => {
    const { clock, service } = buildService();
    service.recordExhausted(HOUR);
    clock.now = HOUR - 1;
    expect(() => {
      service.assertAvailable();
    }).toThrow(ImageQuotaError);
    clock.now = HOUR;
    expect(() => {
      service.assertAvailable();
    }).not.toThrow();
  });

  it("tells the reset time and the minutes left", () => {
    const { service } = buildService();
    service.recordExhausted(90 * MINUTE);
    expect(() => {
      service.assertAvailable();
    }).toThrow(
      /^The image quota of the subscription is used up, so no image was made. It resets at 1970-01-01T01:30:00.000Z, in about 90 minutes/,
    );
  });

  it("uses a 60 minute fallback when the answer has no reset time", () => {
    const { clock, service } = buildService();
    service.recordExhausted(undefined);
    clock.now = HOUR - 1;
    expect(() => {
      service.assertAvailable();
    }).toThrow(ImageQuotaError);
    clock.now = HOUR;
    expect(() => {
      service.assertAvailable();
    }).not.toThrow();
  });

  it("caps a reset time over a day at a day", () => {
    const { clock, service } = buildService();
    service.recordExhausted(3 * DAY);
    clock.now = DAY;
    expect(() => {
      service.assertAvailable();
    }).not.toThrow();
  });

  it("does not block for a reset time of zero", () => {
    const { service } = buildService();
    service.recordExhausted(0);
    expect(() => {
      service.assertAvailable();
    }).not.toThrow();
  });
});
