import { TFile, type App } from "obsidian";
import type { Store } from "./store";
import type { Material } from "./model";
import { UserError } from "./safety";

interface Reader {
  openFile(file: TFile): Promise<unknown>;
  openLearningMaterial?(file: TFile): Promise<unknown>;
}
interface Player {
  openMediaFile(file: TFile, timestamp?: number): Promise<unknown>;
}
// Obsidian does not expose plugin discovery in the public SDK. Confine the
// runtime boundary here; validate each optional capability before calling it.
interface Plugins {
  plugins?: { getPlugin(id: string): unknown };
}
export class Learning {
  constructor(
    private app: App,
    private store: Store,
  ) {}
  requirePlugin(item: Material): Partial<Reader> | Partial<Player> {
    const media = item.kind === "audio" || item.kind === "video";
    const registry = (this.app as unknown as Plugins).plugins;
    const plugin = registry?.getPlugin(media ? "langplayer" : "qiaomu-reader-english") as
      (Partial<Reader> & Partial<Player>) | null;
    if (!plugin || (media ? typeof plugin.openMediaFile !== "function" : typeof plugin.openFile !== "function"))
      throw new UserError(media ? "请启用 Dashell Player 后再打开音视频。" : "请启用 Dashell Reader 后再打开文章。");
    return plugin;
  }
  async open(id: string): Promise<void> {
    const item = this.store.state.materials.find((item) => item.id === id);
    if (!item?.localPath) throw new UserError("请先下载这份资料。");
    const file = this.app.vault.getAbstractFileByPath(item.localPath);
    if (!(file instanceof TFile))
      throw new UserError("本地文件不存在，请重新下载。");
    const plugin = this.requirePlugin(item);
    if (item.kind === "audio" || item.kind === "video") {
      await (plugin as Player).openMediaFile(file);
    } else {
      const reader = plugin as Reader;
      const view = typeof reader.openLearningMaterial === "function"
        ? await reader.openLearningMaterial(file) : await reader.openFile(file);
      if (view === null) throw new UserError("Dashell Reader 无法打开这种文件；本地资料已保留。");
    }
    await this.store.changeMaterial(id, (item) => {
      if (
        !item.sessions.length ||
        item.sessions[item.sessions.length - 1]?.completed
      )
        item.sessions.push({ started: Date.now() });
    });
  }
  finish(id: string): Promise<void> {
    return this.store.changeMaterial(id, (item) => {
      const session = item.sessions[item.sessions.length - 1];
      if (!session) throw new UserError("请先打开资料开始学习。");
      if (!session.completed) session.completed = Date.now();
    });
  }
}
