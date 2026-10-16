import type { PersistSettingsOptions } from "./feed-storage-repository";
interface Batch<T> {
  source: T;
  target: T;
  options: PersistSettingsOptions;
  waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
}
/** Serializes durable writes; burst updates for one live settings object coalesce.
 * A replaced/restored settings object is always a separate ordered batch.
 */
export class SettingsSaveQueue<T> {
  private batches: Batch<T>[] = [];
  private running = false;
  constructor(
    private write: (target: T, options: PersistSettingsOptions) => Promise<void>,
    private snapshot: (target: T) => T = target => target,
  ) {}
  save(target: T, options: PersistSettingsOptions): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      let batch = this.batches[this.batches.length - 1];
      const captured = this.snapshot(target);
      if (!batch || batch.source !== target || Boolean(batch.options.replacesFeedList) !== Boolean(options.replacesFeedList)) {
        batch = { source: target, target: captured, options: { replacesFeedList: options.replacesFeedList }, waiters: [] };
        this.batches.push(batch);
      } else {
        batch.target = captured;
      }
      for (const key of ["forceMetadata", "forceAllShards"] as const) {
        if (options[key]) batch.options[key] = true;
      }
      batch.waiters.push({ resolve, reject });
    });
    if (!this.running) {
      this.running = true;
      void Promise.resolve().then(() => this.flush());
    }
    return promise;
  }
  private async flush(): Promise<void> {
    while (this.batches.length) {
      const batch = this.batches.shift();
      if (!batch) continue;
      try {
        await this.write(batch.target, batch.options);
        for (const waiter of batch.waiters) waiter.resolve();
      } catch (error) {
        for (const waiter of batch.waiters) waiter.reject(error);
      }
    }
    this.running = false;
  }
}
