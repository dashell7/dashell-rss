import { Modal, Setting, Notice, type App } from "obsidian";
import type { Feed } from "../types/types";
import { sourceHealth } from "../dashell/source-health";
export class DashellSourceHealthModal extends Modal {
  constructor(app: App, private feeds: () => Feed[], private save: () => Promise<void>) { super(app); }
  onOpen(): void { this.render(); }
  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("rss-dashboard-modal");
    this.contentEl.createEl("h2", { text: "订阅统计" });
    this.contentEl.createEl("p", { text: "统计仅包含当前本地缓存的文章。打开次数从本次更新后记录。" });
    for (const feed of this.feeds()) {
      const health = sourceHealth(feed);
      new Setting(this.contentEl)
        .setName(feed.title)
        .setDesc(`缓存 ${health.cached} · 已读 ${health.read} · 打开 ${health.opened} · 近30天 ${health.opened30d} · 稍后 ${health.later}${health.error ? `；${health.error}` : ""}`)
        .addToggle(toggle => toggle.setValue(!health.paused).setTooltip("自动刷新").onChange(async value => {
          const previous = feed.excludeFromRefresh;
          const previousInterval = feed.scanInterval;
          feed.excludeFromRefresh = !value;
          if (value && feed.scanInterval === -1) feed.scanInterval = 0;
          try { await this.save(); } catch {
            feed.excludeFromRefresh = previous;
            feed.scanInterval = previousInterval;
            toggle.setValue(!health.paused);
            new Notice("设置未保存，请重试。");
          }
        }));
    }
  }
  onClose(): void { this.contentEl.empty(); }
}
