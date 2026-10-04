import type { Material, State } from "./model";
import { UserError } from "./safety";

// Only download/local-file/session state belongs here. RSS Dashboard continues
// to own subscriptions, read status, favorites and its original user-state shards.
export class Store {
  private tail: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(
    public state: State,
    private write: (state: State) => Promise<void>,
  ) {}
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  transact(change: (next: State) => void): Promise<void> {
    const result = this.tail.then(async () => {
      const next = structuredClone(this.state);
      change(next);
      await this.write(next);
      this.state = next;
      for (const listener of this.listeners) {
        try {
          listener();
        } catch {
          console.warn("[Dashell RSS] Learning controls could not refresh.");
        }
      }
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
  changeMaterial(id: string, change: (item: Material) => void): Promise<void> {
    return this.transact((next) => {
      const item = next.materials.find((item) => item.id === id);
      if (!item) throw new UserError("这份资料已不存在。");
      change(item);
    });
  }
  recoverTasks(): Promise<void> {
    return this.transact((next) =>
      next.materials.forEach((item) => {
        if (item.download === "queued" || item.download === "downloading") {
          item.download = "failed";
          item.error = "上次下载中断，请重试。";
        }
      }),
    );
  }
}
