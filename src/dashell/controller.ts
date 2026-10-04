import { Notice, TFile, type App, type PluginManifest } from "obsidian";
import { readState, type Material } from "./model";
import type { FeedItem } from "../types/types";
import { Store } from "./store";
import { Importer } from "./importer";
import { Learning } from "./learning";
import { network } from "./network";
import { materialFor } from "./material-adapter";
import { displayError, UserError } from "./safety";

export class DashellLearning {
  readonly importer: Importer;
  readonly learning: Learning;
  private stopped = false;
  private openRequest = 0;
  private preparing = new Map<string, Promise<void>>();
  constructor(
    readonly app: App,
    readonly store: Store,
  ) {
    this.importer = new Importer(app, store, network, () => activeDocument);
    this.learning = new Learning(app, store);
  }
  static async load(
    app: App,
    manifest: PluginManifest,
  ): Promise<DashellLearning> {
    const path = `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/dashell-learning.json`;
    const exists = await app.vault.adapter.exists(path);
    const state = readState(
      exists
        ? (JSON.parse(await app.vault.adapter.read(path)) as unknown)
        : null,
    );
    const store = new Store(state, async (next) => {
      if (await app.vault.adapter.exists(path))
        await app.vault.adapter.write(
          `${path}.backup`,
          await app.vault.adapter.read(path),
        );
      await app.vault.adapter.write(path, JSON.stringify(next));
    });
    if (
      state.materials.some((item) =>
        ["queued", "downloading"].includes(item.download),
      )
    )
      await store.recoverTasks();
    return new DashellLearning(app, store);
  }
  dispose(): void {
    this.stopped = true;
    this.openRequest++;
    this.importer.dispose();
  }
  async act(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      new Notice(displayError(error));
    }
  }
  async ensure(item: FeedItem): Promise<Material> {
    if (this.stopped) throw new UserError("插件已停止。");
    const material = await materialFor(item);
    await this.store.transact((next) => {
      const existing = next.materials.find((value) => value.id === material.id);
      if (!existing) next.materials.push(material);
      else if (!this.importer.has(existing.id))
        Object.assign(existing, {
          title: material.title,
          content: material.content,
          link: material.link,
          assets: material.assets,
          translation: material.translation,
          rewrite: material.rewrite,
        });
    });
    return this.store.state.materials.find(
      (value) => value.id === material.id,
    )!;
  }
  async open(
    source: FeedItem,
    content?: () => Promise<string>,
    isCurrent: () => boolean = () => true,
  ): Promise<Material | undefined> {
    if (this.stopped) throw new UserError("插件已停止。");
    const request = ++this.openRequest;
    const snapshot = structuredClone(source);
    const identity = await materialFor(snapshot);
    this.learning.requirePlugin(identity);
    if (this.stopped || request !== this.openRequest || !isCurrent()) return;
    const existing = this.store.state.materials.find(item => item.id === identity.id);
    if (!existing || !this.importer.localReady(existing)) {
      let pending = this.preparing.get(identity.id);
      if (!pending) {
        pending = this.prepare(snapshot, content);
        this.preparing.set(identity.id, pending);
      }
      try { await pending; }
      finally { if (this.preparing.get(identity.id) === pending) this.preparing.delete(identity.id); }
    }
    const material = this.store.state.materials.find(item => item.id === identity.id);
    if (!material || !this.importer.localReady(material))
      throw new UserError(material?.error || "资料尚未保存完成，请重试。");
    if (this.stopped || request !== this.openRequest || !isCurrent()) return;
    await this.learning.open(material.id);
    return this.store.state.materials.find(item => item.id === material.id);
  }
  private async prepare(item: FeedItem, content?: () => Promise<string>): Promise<void> {
    const record = await this.ensure(item);
    const saved = item.savedFilePath && this.app.vault.getAbstractFileByPath(item.savedFilePath);
    if (saved instanceof TFile && saved.extension === "md") {
      await this.store.changeMaterial(record.id, material => {
        material.localPath = saved.path;
        material.localFiles = [saved.path];
        material.download = "ready";
        delete material.error;
      });
      return;
    }
    if (this.importer.has(record.id)) {
      await this.importer.enqueue(record.id);
      return;
    }
    if (!record.assets.length && content) {
      item.content = await content();
      if (this.stopped) throw new UserError("插件已停止。");
      await this.ensure(item);
    }
    await this.importer.enqueue(record.id);
  }
}
