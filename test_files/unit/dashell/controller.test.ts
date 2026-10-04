import { App, TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashellLearning } from "../../../src/dashell/controller";
import { emptyState } from "../../../src/dashell/model";
import type { PluginManifest } from "obsidian";
import { Store } from "../../../src/dashell/store";
import type { FeedItem } from "../../../src/types/types";

function handoff() {
  const app = App.createMock();
  const reader = { openFile: vi.fn(async (_file: TFile) => ({})) };
  Object.assign(app, {
    plugins: { getPlugin: vi.fn(() => reader) },
  });
  const controller = new DashellLearning(
    app,
    new Store(emptyState(), async () => undefined),
  );
  const item: FeedItem = {
    title: "Reader handoff",
    guid: "handoff",
    feedTitle: "QA",
    feedUrl: "https://example.com/rss",
    link: "https://example.com/lesson",
    pubDate: "",
    description: "<p>Summary.</p>",
    coverImage: "",
  };
  return { app, reader, controller, item };
}

describe("Article cards open the learning plugin", () => {
  it("opens a previously saved note without fetching or recreating it", async () => {
    const h = handoff();
    const saved = await h.app.vault.create(
      "My saved article.md",
      "Personal annotations",
    );
    const content = vi.fn(async () => "Replacement content");
    await h.controller.open({ ...h.item, savedFilePath: saved.path }, content);
    expect(h.reader.openFile).toHaveBeenCalledWith(saved);
    expect(content).not.toHaveBeenCalled();
    expect(h.app.vault.getFiles()).toHaveLength(1);
    expect(await h.app.vault.read(saved)).toBe("Personal annotations");
    h.controller.dispose();
  });

  it("uses the Reader material API when available and retains local files if Reader refuses", async () => {
    const h = handoff();
    const openLearningMaterial = vi.fn(
      async (_file: TFile) => ({}) as object | null,
    );
    Object.assign(h.reader, { openLearningMaterial });
    await h.controller.open(h.item, async () => "<p>Article.</p>");
    expect(openLearningMaterial).toHaveBeenCalledOnce();
    expect(h.reader.openFile).not.toHaveBeenCalled();
    const second = {
      ...h.item,
      link: "https://example.com/refused",
      title: "Refused",
    };
    openLearningMaterial.mockResolvedValue(null);
    await expect(
      h.controller.open(second, async () => "<p>Keep this article.</p>"),
    ).rejects.toThrow("本地资料已保留");
    expect(
      h.controller.store.state.materials.find((m) => m.title === "Refused")
        ?.sessions,
    ).toEqual([]);
    expect(h.app.vault.getFiles()).toHaveLength(2);
    h.controller.dispose();
  });

  it("fetches and imports once, then reuses the file without overwriting user edits", async () => {
    const h = handoff();
    const content = vi.fn(async () => "<p>A complete article.</p>");
    await h.controller.open(h.item, content);
    const record = h.controller.store.state.materials[0];
    const file = h.app.vault.getAbstractFileByPath(record.localPath!);
    if (!(file instanceof TFile)) throw new Error("Expected a Markdown file");
    expect(await h.app.vault.read(file)).toContain("A complete article.");
    vi.spyOn(h.app.vault, "read").mockResolvedValue("User's notes and edits");
    const create = vi.spyOn(h.app.vault, "create");
    await h.controller.open(h.item, content);
    expect(content).toHaveBeenCalledOnce();
    expect(h.reader.openFile).toHaveBeenLastCalledWith(file);
    expect(await h.app.vault.read(file)).toBe("User's notes and edits");
    expect(create).not.toHaveBeenCalled();
    expect(h.controller.store.state.materials[0].sessions).toHaveLength(1);
    h.controller.dispose();
  });

  it("coalesces rapid clicks on the same article into one import and one open", async () => {
    const h = handoff();
    const content = vi.fn(async () => "<p>Complete.</p>");
    await Promise.all([
      h.controller.open(h.item, content),
      h.controller.open(h.item, content),
    ]);
    expect(content).toHaveBeenCalledOnce();
    expect(h.app.vault.getFiles()).toHaveLength(1);
    expect(h.reader.openFile).toHaveBeenCalledOnce();
    h.controller.dispose();
  });

  it("keeps a slow earlier article from replacing the latest reader selection", async () => {
    const h = handoff();
    let release!: (value: string) => void;
    const slow = h.controller.open(
      h.item,
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const second = {
      ...h.item,
      link: "https://example.com/second",
      title: "Second",
    };
    await h.controller.open(second, async () => "<p>Second article.</p>");
    release("<p>First article.</p>");
    await slow;
    expect(h.reader.openFile).toHaveBeenCalledOnce();
    expect(h.reader.openFile.mock.calls[0][0].path).toContain("Second");
    h.controller.dispose();
  });

  it("checks the reader before downloading and propagates import failures without starting a session", async () => {
    const h = handoff();
    Object.assign(h.app, { plugins: { getPlugin: () => null } });
    const content = vi.fn(async () => "<p>Article.</p>");
    await expect(h.controller.open(h.item, content)).rejects.toThrow(
      "Dashell Reader",
    );
    expect(content).not.toHaveBeenCalled();
    expect(h.app.vault.getFiles()).toHaveLength(0);
    Object.assign(h.app, { plugins: { getPlugin: () => h.reader } });
    await expect(
      h.controller.open({ ...h.item, description: "" }, async () => ""),
    ).rejects.toThrow("正文");
    expect(h.reader.openFile).not.toHaveBeenCalled();
    expect(h.controller.store.state.materials[0].sessions).toEqual([]);
    h.controller.dispose();
  });

  it("does not open a finished import after the initiating dashboard has closed", async () => {
    const h = handoff();
    await h.controller.open(
      h.item,
      async () => "<p>Article.</p>",
      () => false,
    );
    expect(h.reader.openFile).not.toHaveBeenCalled();
    h.controller.dispose();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.empty();
});
describe("Learning state persistence in an existing plugin directory", () => {
  it("preserves the previous save as backup across repeated updates without exclusive-copy errors", async () => {
    const app = App.createMock();
    const manifest: PluginManifest = {
      id: "rss-dashboard",
      name: "Dashell RSS",
      version: "test",
      minAppVersion: "1.8.7",
      description: "",
      author: "",
      dir: "config/plugins/rss-dashboard",
    };
    const path = `${manifest.dir}/dashell-learning.json`;
    const files = new Map([[path, JSON.stringify(emptyState())]]);
    Object.assign(app.vault.adapter, {
      exists: vi.fn(async (name: string) => files.has(name)),
      read: vi.fn(async (name: string) => {
        const content = files.get(name);
        if (!content) throw new Error("Missing file");
        return content;
      }),
      write: vi.fn(async (name: string, content: string) => {
        files.set(name, content);
      }),
      copy: vi.fn(async (_source: string, target: string) => {
        if (files.has(target)) throw new Error("EEXIST");
        files.set(target, files.get(path)!);
      }),
    });
    const controller = await DashellLearning.load(app, manifest);
    await controller.store.transact((next) => {
      next.preferences.folder = "First";
    });
    await controller.store.transact((next) => {
      next.preferences.folder = "Second";
    });
    expect(JSON.parse(files.get(`${path}.backup`)!).preferences.folder).toBe(
      "First",
    );
    const reloaded = await DashellLearning.load(app, manifest);
    expect(reloaded.store.state.preferences.folder).toBe("Second");
    controller.dispose();
    reloaded.dispose();
  });
});
