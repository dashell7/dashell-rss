import { TFile, TFolder, type App } from "obsidian";
import TurndownService from "turndown";
import { articleFragment } from "./content";
import { articleFileNames } from "./article-filenames";
import type { Material, Mode } from "./model";
import type { Network } from "./network";
import { displayError, resourceName, safeFolder, UserError } from "./safety";
import type { Store } from "./store";

interface Job {
  id: string;
  cancelled: boolean;
  folder?: string;
  files: TFile[];
  result?: Promise<void>;
}
export class Importer {
  private jobs = new Map<string, Job>();
  private tail: Promise<void> = Promise.resolve();
  private stopped = false;
  constructor(
    private app: App,
    private store: Store,
    private network: Network,
    private doc: () => Document,
  ) {}
  has(id: string): boolean {
    return this.jobs.has(id);
  }
  localReady(item: Material): boolean {
    return (
      !!item.localPath &&
      this.app.vault.getAbstractFileByPath(item.localPath) instanceof TFile &&
      (item.localFiles ?? []).every(
        (path) => this.app.vault.getAbstractFileByPath(path) instanceof TFile,
      )
    );
  }
  async enqueue(id: string): Promise<void> {
    if (this.stopped) return;
    const existingJob = this.jobs.get(id);
    if (existingJob) return existingJob.result;
    const item = this.store.state.materials.find((item) => item.id === id);
    if (!item) throw new UserError("资料不存在。");
    if (this.localReady(item)) return;
    const job: Job = { id, cancelled: false, files: [] };
    this.jobs.set(id, job);
    job.result = this.queue(job);
    return job.result;
  }
  private async queue(job: Job): Promise<void> {
    const id = job.id;
    try {
      await this.store.changeMaterial(id, (item) => {
        item.download = "queued";
        delete item.error;
      });
    } catch (error) {
      this.jobs.delete(id);
      throw error;
    }
    const result = this.tail.then(() => this.run(job));
    this.tail = result.catch(() => undefined);
    return result;
  }
  async cancel(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    job.cancelled = true;
    await this.store.changeMaterial(id, (item) => {
      item.download = "failed";
      item.error = "下载已取消，可以重试。";
    });
  }
  dispose(): void {
    this.stopped = true;
    this.jobs.forEach((job) => {
      job.cancelled = true;
    });
  }
  private check(job: Job): void {
    if (this.stopped || job.cancelled)
      throw new UserError("下载已取消，可以重试。");
  }
  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    for (let index = 1; index <= parts.length; index++) {
      const current = parts.slice(0, index).join("/");
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && !(existing instanceof TFolder))
        throw new UserError("下载目录被同名文件占用。");
      if (!existing) await this.app.vault.createFolder(current);
    }
  }
  private async createFolder(job: Job, item: Material): Promise<string> {
    const root = safeFolder(this.store.state.preferences.folder);
    await this.ensureFolder(root);
    this.check(job);
    const slug =
      Array.from(item.title)
        .map((char) => (char.charCodeAt(0) < 32 ? "-" : char))
        .join("")
        .replace(/[<>:"/\\|?*]/g, "-")
        .replace(/^[. ]+|[. ]+$/g, "")
        .slice(0, 50) || "material";
    const base = `${root}/${slug}-${item.id.slice(0, 10)}`;
    let folder = base;
    let suffix = 1;
    while (this.app.vault.getAbstractFileByPath(folder))
      folder = `${base}-${suffix++}`;
    await this.app.vault.createFolder(folder);
    job.folder = folder;
    return folder;
  }
  private markdown(item: Material, mode: Mode = "original"): string {
    const fragment = articleFragment(
      mode === "original" ? item.content : item[mode] ?? "",
      mode,
      this.doc(),
      true,
      item.link || undefined,
    );
    // Reader lookup skips anchors. Unwrap only the saved copy, keeping child markup.
    for (const link of fragment.querySelectorAll("a")) {
      link.replaceWith(...link.childNodes);
    }
    const container = this.doc().win.createDiv();
    container.append(fragment);
    const body = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    }).turndown(container.innerHTML);
    if (!body.trim())
      throw new UserError("这个订阅没有提供正文，请打开来源查看。");
    const names = articleFileNames(item.title);
    const versions = { version: 1, id: item.id, title: item.title, original: names.original, ...(item.translation ? { translation: names.translation } : {}), ...(item.rewrite ? { rewrite: names.rewrite } : {}) };
    return `---\ndashell_material_id: ${JSON.stringify(item.id)}\nsource: ${JSON.stringify(item.link)}\ndashell_reader_versions: ${JSON.stringify(versions)}\n---\n\n# ${item.title.replace(/[\r\n]/g, " ")}\n\n${body}\n`;
  }
  private async writeArticle(job: Job, item: Material, folder: string): Promise<string> {
    const modes: Mode[] = ["original"];
    const names = articleFileNames(item.title);
    if (item.translation) modes.push("translation");
    if (item.rewrite) modes.push("rewrite");
    for (const mode of modes) {
      this.check(job);
      const file = await this.app.vault.create(`${folder}/${names[mode]}`, this.markdown(item, mode));
      job.files.push(file);
    }
    return `${folder}/${names.original}`;
  }
  private async writeAssets(
    job: Job,
    item: Material,
    folder: string,
  ): Promise<string> {
    let main = "";
    const limit = this.store.state.preferences.maxFileMB * 1024 * 1024;
    for (const asset of item.assets) {
      this.check(job);
      if (asset.bytes !== undefined && asset.bytes > limit)
        throw new UserError("素材清单中的文件超过大小限制。");
      try {
        const bytes = await this.network.binary(asset.url, limit);
        this.check(job);
        const path = `${folder}/${resourceName(asset.role, asset.extension)}`;
        const file = await this.app.vault.createBinary(path, bytes);
        job.files.push(file);
        this.check(job);
        if (asset.role === "main") main = path;
      } catch (error) {
        if (
          asset.required ||
          asset.role === "main" ||
          job.cancelled ||
          this.stopped
        )
          throw error;
      }
    }
    if (!main) throw new UserError("素材包缺少可打开的主文件。");
    const note = await this.app.vault.create(
      `${folder}/来源.md`,
      `# ${item.title.replace(/[\r\n]/g, " ")}\n\n[打开资料](<${resourceName("main", item.assets.find((asset) => asset.role === "main")!.extension)}>)\n\n${item.link ? `[原始来源](<${item.link}>)` : ""}\n\n素材编号：${item.id}\n`,
    );
    job.files.push(note);
    return main;
  }
  private async run(job: Job): Promise<void> {
    let ready = false;
    try {
      this.check(job);
      const item = structuredClone(
        this.store.state.materials.find((item) => item.id === job.id),
      );
      if (!item) throw new UserError("资料不存在。");
      await this.store.changeMaterial(job.id, (item) => {
        item.download = "downloading";
      });
      this.check(job);
      const folder = await this.createFolder(job, item);
      let main: string;
      if (item.assets.length) main = await this.writeAssets(job, item, folder);
      else main = await this.writeArticle(job, item, folder);
      this.check(job);
      await this.store.changeMaterial(job.id, (item) => {
        this.check(job);
        item.localPath = main;
        item.localFiles = job.files.map((file) => file.path);
        item.download = "ready";
        delete item.error;
      });
      ready = true;
    } catch (error) {
      if (!this.stopped)
        await this.store.changeMaterial(job.id, (item) => {
          item.download = "failed";
          item.error = displayError(error);
        });
    } finally {
      if (!ready) {
        // Only files created by this task may be removed; never delete a user's existing folder.
        for (const file of job.files)
          await this.app.fileManager.trashFile(file).catch(() => undefined);
      }
      this.jobs.delete(job.id);
    }
  }
}
