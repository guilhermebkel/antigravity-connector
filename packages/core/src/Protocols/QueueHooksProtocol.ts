export type QueueHooks = {
  onWaiting?: (position: number) => void;
  onStarted?: () => void;
};
