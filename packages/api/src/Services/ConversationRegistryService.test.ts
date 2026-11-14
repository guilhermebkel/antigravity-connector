import { describe, expect, it } from "vitest";
import type { AgyStreamOutputEvent } from "@antigravity-connector/core";
import { ConversationRegistryService } from "@antigravity-connector/api/Services/ConversationRegistryService.ts";

const DAY_MS = 86400000;
const MODEL = "gemini-3.8-flash";

type Clock = { now: number };

const buildRegistry = (): {
  registry: ConversationRegistryService; clock: Clock;
} => {
  const clock: Clock = { now: 0 };
  return { registry: new ConversationRegistryService({ clock: () => clock.now }), clock };
};

const buildSource = async function* (events: AgyStreamOutputEvent[]): AsyncGenerator<AgyStreamOutputEvent> {
  for (const event of events) {
    await Promise.resolve();
    yield event;
  }
};

describe("ConversationRegistryService", () => {
  it("remembers the model of a conversation", () => {
    const { registry } = buildRegistry();
    registry.save("conv-1", MODEL);

    expect(registry.readModel("conv-1")).toBe(MODEL);
    expect(registry.readModel("conv-unknown")).toBeUndefined();
  });

  it("AC2: an id expires after 24 hours", () => {
    const { registry, clock } = buildRegistry();
    registry.save("conv-1", MODEL);
    clock.now = DAY_MS + 1;

    expect(registry.readModel("conv-1")).toBeUndefined();
  });

  it("AC4: when the map is full, the least recently used id is dropped", () => {
    const { registry, clock } = buildRegistry();
    for (let index = 0; index < ConversationRegistryService.MAX_ENTRIES; index += 1) {
      clock.now += 1;
      registry.save(`conv-${index}`, MODEL);
    }
    registry.readModel("conv-0");
    clock.now += 1;
    registry.save("conv-new", MODEL);

    expect(registry.readModel("conv-0")).toBe(MODEL);
    expect(registry.readModel("conv-1")).toBeUndefined();
  });

  it("records the id of a started stream and passes every event through", async () => {
    const { registry } = buildRegistry();
    const events: AgyStreamOutputEvent[] = [
      { kind: "started", conversationId: "conv-stream" },
      { kind: "text", delta: "hi" },
    ];
    const forwarded: AgyStreamOutputEvent[] = [];
    for await (const event of registry.observe(buildSource(events), MODEL)) {
      forwarded.push(event);
    }

    expect(forwarded).toStrictEqual(events);
    expect(registry.readModel("conv-stream")).toBe(MODEL);
  });
});
