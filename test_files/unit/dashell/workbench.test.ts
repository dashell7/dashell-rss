import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadingWorkbench } from "../../../src/dashell/workbench";
import type { WorkbenchOptions } from "../../../src/dashell/workbench-contract";
import {
  DEFAULT_SETTINGS,
  type Feed,
  type FeedItem,
} from "../../../src/types/types";

const article = (
  guid: string,
  feedUrl = "https://example.com/rss",
): FeedItem => ({
  guid,
  feedUrl,
  feedTitle: "Reading",
  title: `Article ${guid}`,
  link: `https://example.com/${guid}`,
  description: "A short description.",
  pubDate: "2026-10-02",
  coverImage: "",
  content: "Original content.",
});

function surface(
  render: WorkbenchOptions["renderArticle"] = vi.fn(
    async (body: HTMLElement, item: FeedItem) => {
      body.createDiv({ cls: "rss-reader-article-content", text: item.title });
    },
  ),
) {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  const root = document.body.createDiv();
  const items = [
    article("one"),
    article("two"),
    article("three", "https://other.example/rss"),
  ];
  const feeds: Feed[] = [
    {
      title: "Reading",
      url: items[0].feedUrl,
      folder: "Books",
      items: items.slice(0, 2),
      lastUpdated: 0,
    },
    {
      title: "Listening",
      url: items[2].feedUrl,
      folder: "Audio",
      items: items.slice(2),
      lastUpdated: 0,
    },
  ];
  const settings = structuredClone(DEFAULT_SETTINGS);
  const savePreferences = vi.fn(async () => undefined);
  const update = vi.fn(async (item: FeedItem, changes: Partial<FeedItem>) => {
    Object.assign(item, changes);
  });
  const view = new ReadingWorkbench({
    root,
    settings,
    feeds: () => feeds,
    items: () => items,
    renderArticle: render,
    disposeArticle: vi.fn(),
    update,
    saveArticle: vi.fn(async () => undefined),
    selectArticle: vi.fn(),
    refresh: vi.fn(async () => undefined),
    manageFeeds: vi.fn(),
    openSettings: vi.fn(),
    savePreferences,
  });
  return { root, view, items, settings, savePreferences, update };
}

afterEach(() => {
  document.body.empty();
  vi.restoreAllMocks();
});

describe("Qiaomu-style reading workbench", () => {
  it("keeps the article list alongside the selected text and returns to it after folding", async () => {
    const { root, view, items } = surface();
    await view.open(items[0]);
    expect(root.querySelectorAll(".rss-workbench-entry")).toHaveLength(3);
    expect(root.querySelector(".rss-workbench-body")?.textContent).toContain(
      "Article one",
    );
    root
      .querySelector<HTMLButtonElement>('[aria-label="收起文章列表"]')!
      .click();
    expect(root.classList.contains("rss-workbench-focused")).toBe(true);
    root
      .querySelector<HTMLButtonElement>('[aria-label="展开文章列表"]')!
      .click();
    expect(root.classList.contains("rss-workbench-focused")).toBe(false);
    view.dispose();
  });

  it("restores the selected article, search and independent offsets for each channel", async () => {
    const { root, view, items, settings } = surface();
    view.setChannel(items[0].feedUrl);
    await view.open(items[1]);
    const search = root.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    search.value = "two";
    search.dispatchEvent(new Event("input"));
    const list = root.querySelector<HTMLElement>(".rss-workbench-list")!;
    const body = root.querySelector<HTMLElement>(".rss-workbench-body")!;
    list.scrollTop = 85;
    body.scrollTop = 120;
    view.setChannel(items[2].feedUrl);
    await view.open(items[2]);
    view.setChannel(items[0].feedUrl);
    await vi.waitFor(() =>
      expect(root.querySelector(".rss-workbench-body")?.textContent).toContain(
        "Article two",
      ),
    );
    expect(search.value).toBe("two");
    expect(list.scrollTop).toBe(85);
    expect(
      root.querySelector<HTMLElement>(".rss-workbench-body")!.scrollTop,
    ).toBe(120);
    view.dispose();
    expect(settings.dashellWorkspace?.channels[items[0].feedUrl].query).toBe(
      "two",
    );
  });

  it("keeps an opened unread article visible until the user switches channel or filter", async () => {
    const { root, view, items, settings } = surface();
    settings.display.autoMarkReadOnOpen = true;
    view.setFilter("unread");
    await view.open(items[0]);
    expect(items[0].read).toBe(true);
    view.refresh();
    expect(root.querySelectorAll(".rss-workbench-entry")).toHaveLength(3);
    view.setFilter("favorites");
    view.setFilter("unread");
    expect(root.querySelectorAll(".rss-workbench-entry")).toHaveLength(2);
    view.dispose();
  });

  it("ignores late article responses and releases their detached controls", async () => {
    let finish: (() => void) | undefined;
    const staleCleanup = vi.fn();
    const render = vi.fn(async (body: HTMLElement, item: FeedItem) => {
      if (item.guid === "one")
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      body.createDiv({ text: item.title });
      return item.guid === "one" ? staleCleanup : () => undefined;
    });
    const { root, view, items } = surface(render);
    const first = view.open(items[0]);
    await vi.waitFor(() => expect(finish).toBeDefined());
    await view.open(items[1]);
    finish!();
    await first;
    expect(root.querySelector(".rss-workbench-body")?.textContent).toContain(
      "Article two",
    );
    expect(
      root.querySelector(".rss-workbench-body")?.textContent,
    ).not.toContain("Article one");
    expect(staleCleanup).toHaveBeenCalledOnce();
    view.dispose();
  });

  it("allows keyboard resizing, clamps widths and flushes the last scroll on close", async () => {
    const { root, view, items, settings, savePreferences } = surface();
    await view.open(items[0]);
    const splitter = root.querySelector<HTMLElement>('[role="separator"]')!;
    splitter.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(settings.dashellWorkspace?.listWidth).toBe(320);
    splitter.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    expect(settings.dashellWorkspace?.listWidth).toBe(220);
    const body = root.querySelector<HTMLElement>(".rss-workbench-body")!;
    body.scrollTop = 321;
    view.dispose();
    expect(settings.dashellWorkspace?.channels["@all"].readerTop).toBe(321);
    expect(savePreferences).toHaveBeenCalled();
  });

  it("does not overwrite a remembered reading position when its tab becomes hidden", async () => {
    const { view, root, items, settings } = surface();
    await view.open(items[0]);
    root.querySelector<HTMLElement>(".rss-workbench-body")!.scrollTop = 275;
    view.setChannel(items[2].feedUrl);
    await view.open(items[2]);
    view.setChannel("@all");
    await vi.waitFor(() =>
      expect(root.querySelector(".rss-workbench-body")?.textContent).toContain(
        "Article one",
      ),
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(0);
    root.querySelector<HTMLElement>(".rss-workbench-body")!.scrollTop = 0;
    view.dispose();
    expect(settings.dashellWorkspace?.channels["@all"].readerTop).toBe(275);
  });
});
