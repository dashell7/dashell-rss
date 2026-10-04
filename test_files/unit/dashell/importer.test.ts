import { App, TFile } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Importer } from "../../../src/dashell/importer";
import { Store } from "../../../src/dashell/store";
import { emptyState, type Material } from "../../../src/dashell/model";
import type { Network } from "../../../src/dashell/network";
import { Learning } from "../../../src/dashell/learning";
import { articleFragment } from "../../../src/dashell/content";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.empty();
});
function setup(overrides: Partial<Material> = {}) {
  const app = App.createMock();
  // Model the binary vault boundary using the stub's ordinary file registry.
  Object.assign(app.vault, {
    createBinary: async (path: string, _bytes: ArrayBuffer) =>
      app.vault.create(path, "binary-fixture"),
  });
  const state = emptyState();
  state.materials.push({
    id: "abc123",
    title: "A lesson",
    link: "https://example.com/lesson",
    content: "<p>Original sentence.</p>",
    published: "",
    language: "en",
    level: "B1",
    kind: "article",
    assets: [],
    sessions: [],
    download: "idle",
    ...overrides,
  });
  const store = new Store(state, async () => undefined);
  const network: Network = {
    text: vi.fn(),
    binary: vi.fn(async () => new ArrayBuffer(12)),
  };
  const importer = new Importer(app, store, network, () => document);
  return { app, store, network, importer };
}
describe("Dashell downloads preserve files and truthful status", () => {
  it("saves linked words as lookup text in every supplied article version, preserving formatting and images", async () => {
    const html = `<p>Read <a href="/story"><strong>important</strong> <em>words</em></a>, then <a href="#note">study</a>.
      <a href="/one">One</a> <a href="/two">two</a>.</p>
      <p><a href="/photo"><img src="/photo.jpg" alt="A photo"></a></p>
      <p><a>Named anchor</a> and <a href="javascript:unsafe()">safe label</a>.</p>`;
    const h = setup({
      content: html,
      translation: '<p>Read <a href="/translated"><strong>translated words</strong></a>.</p>',
      rewrite: 'Read [**simpler** *words*](https://example.com/rewrite).\n\n[![A photo](/photo.jpg)](/photo)',
    });
    await h.importer.enqueue("abc123");
    expect(h.store.state.materials[0].download).toBe("ready");
    for (const file of h.app.vault.getFiles()) {
      const markdown = await h.app.vault.read(file);
      expect(markdown).toContain('source: "https://example.com/lesson"');
      const body = markdown.slice(markdown.indexOf("\n---\n") + 5);
      const rendered = articleFragment(body, "rewrite", document, true);
      expect(rendered.querySelectorAll("a")).toHaveLength(0);
      if (file.name === "A lesson.md") {
        expect(body).toContain("**important** _words_, then study.");
        expect(rendered.textContent).toContain("One two.");
        expect(rendered.textContent).toContain("Named anchor and safe label.");
        expect(rendered.querySelector("img")?.getAttribute("src")).toBe("https://example.com/photo.jpg");
      } else if (file.name === "A lesson - 译文.md") {
        expect(body).toContain("**translated words**");
      } else {
        expect(body).toContain("**simpler** _words_");
        expect(rendered.querySelector("img")?.getAttribute("alt")).toBe("A photo");
      }
    }
    expect(articleFragment(html, "original", document, true, "https://example.com/lesson").querySelectorAll("a")).toHaveLength(7);
    expect(h.store.state.materials[0].content).toBe(html);
  });
  it("saves supplied versions as separate Markdown files with a shared reader manifest", async () => {
    const h = setup({ translation: "<p>完整译文。</p>", rewrite: "A **simpler** article." });
    await h.importer.enqueue("abc123");
    const files = h.app.vault.getFiles();
    expect(files).toHaveLength(3);
    const translation = files.find(file => file.name === "A lesson - 译文.md")!;
    expect(translation).toBeDefined();
    expect(await h.app.vault.read(translation)).toContain("完整译文");
    const original = files.find(file => file.name === "A lesson.md")!;
    expect(await h.app.vault.read(original)).toContain("dashell_reader_versions:");
    expect(await h.app.vault.read(original)).toContain('"rewrite":"A lesson - 改写.md"');
    expect(h.store.state.materials[0].localFiles).toHaveLength(3);
  });
  it("keeps same-title articles separate without overwriting existing files", async () => {
    const h = setup();
    await h.importer.enqueue("abc123");
    const first = h.store.state.materials[0];
    await h.store.transact(state => {
      state.materials.push({ ...first, id: "second", localPath: undefined, localFiles: [], download: "idle", content: "<p>Second article.</p>" });
    });
    await h.importer.enqueue("second");
    const second = h.store.state.materials[1];
    expect(first.localPath).toMatch(/\/A lesson\.md$/);
    expect(second.localPath).toMatch(/\/A lesson\.md$/);
    expect(second.localPath).not.toBe(first.localPath);
    const original = h.app.vault.getAbstractFileByPath(first.localPath!);
    if (!(original instanceof TFile)) throw new Error("Original article missing");
    expect(await h.app.vault.read(original)).toContain("Original sentence.");
  });
  it("saves sanitized article Markdown and does not download a valid local record twice", async () => {
    const h = setup({
      content: "<p>Readable sentence.</p><script>unsafe()</script>",
    });
    await h.importer.enqueue("abc123");
    const item = h.store.state.materials[0];
    expect(item.download).toBe("ready");
    const file = h.app.vault.getAbstractFileByPath(item.localPath!);
    if (!(file instanceof TFile))
      throw new Error("Expected a local Markdown file");
    expect(await h.app.vault.read(file)).toContain("Readable sentence.");
    expect(await h.app.vault.read(file)).not.toContain("unsafe()");
    const count = h.app.vault.getFiles().length;
    await h.importer.enqueue(item.id);
    expect(h.app.vault.getFiles()).toHaveLength(count);
  });
  it("imports media and the required subtitle with matching basenames", async () => {
    const h = setup({
      kind: "audio",
      assets: [
        {
          url: "https://example.com/a.mp3",
          role: "main",
          extension: "mp3",
          required: true,
        },
        {
          url: "https://example.com/a.srt",
          role: "subtitle",
          extension: "srt",
          required: true,
        },
      ],
    });
    await h.importer.enqueue("abc123");
    const item = h.store.state.materials[0];
    expect(item.download).toBe("ready");
    expect(
      item.localFiles?.some((path) => path.endsWith("/material.srt")),
    ).toBe(true);
    expect(item.localPath?.endsWith("/material.mp3")).toBe(true);
  });
  it("does not mark media ready when a required subtitle fails, and cleans only its created files", async () => {
    const h = setup({
      kind: "audio",
      assets: [
        {
          url: "https://example.com/a.mp3",
          role: "main",
          extension: "mp3",
          required: true,
        },
        {
          url: "https://example.com/a.srt",
          role: "subtitle",
          extension: "srt",
          required: true,
        },
      ],
    });
    const existing = await h.app.vault.create("user-note.md", "KEEP");
    vi.mocked(h.network.binary)
      .mockResolvedValueOnce(new ArrayBuffer(12))
      .mockRejectedValueOnce(
        new Error("timeout https://secret.test/?token=private"),
      );
    await h.importer.enqueue("abc123");
    expect(h.store.state.materials[0]?.download).toBe("failed");
    expect(h.store.state.materials[0]?.error).not.toContain("private");
    expect(h.app.vault.getFiles()).toHaveLength(1);
    expect(await h.app.vault.read(existing)).toBe("KEEP");
  });
  it("cancels an in-flight response before it can write a local file", async () => {
    const h = setup({
      kind: "audio",
      assets: [
        {
          url: "https://example.com/a.mp3",
          role: "main",
          extension: "mp3",
          required: true,
        },
      ],
    });
    let release!: (bytes: ArrayBuffer) => void;
    vi.mocked(h.network.binary).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = h.importer.enqueue("abc123");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await h.importer.cancel("abc123");
    release(new ArrayBuffer(12));
    await pending;
    expect(h.app.vault.getFiles()).toHaveLength(0);
    expect(h.store.state.materials[0]?.localPath).toBeUndefined();
    expect(h.store.state.materials[0]?.download).toBe("failed");
  });
  it("makes interrupted tasks retryable after reloading state", async () => {
    const h = setup({ download: "downloading" });
    await h.store.recoverTasks();
    expect(h.store.state.materials[0]?.download).toBe("failed");
    expect(h.store.state.materials[0]?.error).toContain("中断");
  });
  it("does not invent a started session when the target learning plugin is missing", async () => {
    const h = setup();
    await h.importer.enqueue("abc123");
    await expect(new Learning(h.app, h.store).open("abc123")).rejects.toThrow(
      "Dashell Reader",
    );
    expect(h.store.state.materials[0]?.sessions).toEqual([]);
  });
});
