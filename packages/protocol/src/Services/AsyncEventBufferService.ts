export class AsyncEventBufferService<T> {
  private readonly items: T[] = [];

  private isEnded = false;

  private endError: unknown = undefined;

  private wakeConsumer: (() => void) | undefined = undefined;

  push(item: T): void {
    this.items.push(item);
    this.notifyConsumer();
  }

  end(error?: unknown): void {
    if (this.isEnded) {
      return;
    }
    this.isEnded = true;
    this.endError = error;
    this.notifyConsumer();
  }

  async* readItems(): AsyncGenerator<T, void, undefined> {
    let next = await this.takeNext();
    while (next !== undefined) {
      yield next.value;
      next = await this.takeNext();
    }
  }

  private async takeNext(): Promise<{ value: T } | undefined> {
    while (this.items.length === 0 && !this.isEnded) {
      await this.waitForChange();
    }
    const item = this.items.shift();
    if (item !== undefined) {
      return { value: item };
    }
    if (this.endError !== undefined) {
      throw AsyncEventBufferService.buildError(this.endError);
    }
    return undefined;
  }

  static buildError(reason: unknown): Error {
    return reason instanceof Error ? reason : new Error(String(reason));
  }

  private waitForChange(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.wakeConsumer = resolve;
    });
  }

  private notifyConsumer(): void {
    const wake = this.wakeConsumer;
    this.wakeConsumer = undefined;
    wake?.();
  }
}
