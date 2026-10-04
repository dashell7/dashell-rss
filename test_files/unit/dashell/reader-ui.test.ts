import { afterEach, describe, expect, it, vi } from "vitest";
import { readerStart } from "../../../src/dashell/reader-chrome";
import { mountLearningPanel, versionControls } from "../../../src/dashell/learning-panel";
import { DashellLearning } from "../../../src/dashell/controller";
import { Store } from "../../../src/dashell/store";
import { emptyState } from "../../../src/dashell/model";
import { App } from "obsidian";
import type { FeedItem } from "../../../src/types/types";

afterEach(() => {
  document.body.empty();
  vi.restoreAllMocks();
});
const item: FeedItem = {
  title: "Reading",
  guid: "1",
  link: "https://example.com/a",
  feedUrl: "https://example.com/rss",
  feedTitle: "Feed",
  description: "",
  pubDate: "",
  coverImage: "",
  dashell: {
    translation: "<p>译文</p><script>bad()</script>",
    rewrite: "A **simple** sentence.",
  },
};
function surface() {
  const root = document.body.createDiv({ cls: "rss-dashell-reader" });
  const toolbar = root.createDiv();
  readerStart(
    toolbar,
    () => undefined,
    () => undefined,
  );
  const container = root.createDiv();
  const body = container.createDiv({ cls: "rss-reader-article-content" });
  const original = body.createEl("p", { text: "Original sentence." });
  const panel = container.createDiv();
  return { root, container, body, original, panel };
}
describe("Qiaomu RSS reading interface adaptation", () => {
  it.each(["podcast", "video"] as const)("keeps %s preview free of Dashell download and learning controls", mediaType => {
    const container = document.body.createDiv();
    const controller = new DashellLearning(App.createMock(), new Store(emptyState(), async () => undefined));
    const cleanup = mountLearningPanel(container, { ...item, mediaType }, controller);
    expect(container.querySelector(".rss-dashell-learning-panel")).toBeNull();
    cleanup();
    controller.dispose();
  });
  it("routes native button navigation to the existing article actions", () => {
    const parent = document.body.createDiv();
    const previous = vi.fn(),
      next = vi.fn();
    readerStart(parent, previous, next);
    const buttons = parent.querySelectorAll("button");
    buttons[0].click();
    buttons[1].click();
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(parent.querySelector("select")?.disabled).toBe(true);
  });
  it("switches source versions safely and restores the same original DOM nodes", () => {
    const view = surface();
    const cleanup = versionControls(view.panel, view.container, item);
    const select = view.root.querySelector("select")!;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "original",
      "translation",
      "rewrite",
    ]);
    select.value = "translation";
    select.dispatchEvent(new Event("change"));
    expect(view.body.textContent).toBe("译文");
    expect(view.body.querySelector("script")).toBeNull();
    select.value = "rewrite";
    select.dispatchEvent(new Event("change"));
    expect(view.body.querySelector("strong")?.textContent).toBe("simple");
    select.value = "original";
    select.dispatchEvent(new Event("change"));
    expect(view.body.firstChild).toBe(view.original);
    cleanup();
    expect(view.root.querySelector("select")).toBeNull();
  });
  it("shows only available source versions and replaces controls when the article changes", () => {
    const view = surface();
    versionControls(view.panel, view.container, item)();
    const cleanup = versionControls(view.panel, view.container, {
      ...item,
      dashell: undefined,
    });
    expect(view.root.querySelectorAll("select")).toHaveLength(1);
    expect(view.root.querySelectorAll("option")).toHaveLength(1);
    expect(view.root.querySelector("select")?.disabled).toBe(true);
    cleanup();
  });
  it("supports an inline preview without a standalone reader toolbar", () => {
    const container = document.body.createDiv();
    container.createDiv({ cls: "rss-reader-article-content" });
    const panel = container.createDiv();
    const cleanup = versionControls(panel, container, item);
    expect(panel.querySelector("select")).not.toBeNull();
    cleanup();
    expect(panel.childElementCount).toBe(0);
  });
});
