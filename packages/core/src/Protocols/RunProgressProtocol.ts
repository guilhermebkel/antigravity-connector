import type { AgyStepType } from "@antigravity-connector/protocol";

export type RunProgressQueued = {
  kind: "queued";
  position: number;
};

export type RunProgressStarted = { kind: "started" };

export type RunProgressActivity = {
  kind: "activity";
  stepType: AgyStepType;
};

export type RunProgressText = { kind: "text" };

export type RunProgressEvent = RunProgressQueued | RunProgressStarted | RunProgressActivity | RunProgressText;

export type RunObserver = (event: RunProgressEvent) => void;
