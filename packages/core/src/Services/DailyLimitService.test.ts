import { describe, expect, it } from "vitest";
import { DailyLimitService } from "@antigravity-connector/core/Services/DailyLimitService.ts";
import { DailyLimitError } from "@antigravity-connector/core/Errors/DailyLimitError.ts";

const LIMITS = { chat: 200, search: 50, image: 2, research: 5, browse: 20 };
const MORNING = "2026-11-14T10:00:00.000Z";
const JUST_BEFORE_MIDNIGHT = "2026-11-14T23:59:00.000Z";
const JUST_AFTER_MIDNIGHT = "2026-11-15T00:00:01.000Z";
const LIMIT_MESSAGE = "The daily limit of 2 image calls is reached; it resets at 2026-11-15T00:00:00.000Z";

type MutableClock = {
  now: () => Date;
  moveTo: (iso: string) => void;
};

const createClock = (initial: string): MutableClock => {
  let current = new Date(initial);
  return {
    now: () => current,
    moveTo: (iso: string) => {
      current = new Date(iso);
    },
  };
};

const createService = (clock: MutableClock): DailyLimitService =>
  new DailyLimitService({ runKindToLimit: LIMITS, clock: clock.now });

describe("DailyLimitService.consume", () => {
  it("refuses the call over the limit with the reset time at the next UTC midnight", () => {
    const service = createService(createClock(MORNING));
    service.consume("image");
    service.consume("image");

    expect(() => {
      service.consume("image");
    }).toThrow(DailyLimitError);
    expect(() => {
      service.consume("image");
    }).toThrow(LIMIT_MESSAGE);
  });

  it("still allows a chat call when the image limit is reached", () => {
    const service = createService(createClock(MORNING));
    service.consume("image");
    service.consume("image");

    expect(() => {
      service.consume("chat");
    }).not.toThrow();
  });

  it("starts every counter again when the clock crosses midnight UTC", () => {
    const clock = createClock(JUST_BEFORE_MIDNIGHT);
    const service = createService(clock);
    service.consume("image");
    service.consume("image");
    clock.moveTo(JUST_AFTER_MIDNIGHT);

    expect(() => {
      service.consume("image");
    }).not.toThrow();
  });
});
