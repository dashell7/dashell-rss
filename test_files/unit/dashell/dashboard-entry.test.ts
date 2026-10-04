import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, type WorkspaceLeaf } from "obsidian";
import { RssDashboardView } from "../../../src/views/dashboard-view";
import type RssDashboardPlugin from "../../../main";
import { DEFAULT_SETTINGS, type Feed } from "../../../src/types/types";

vi.mock("../../../src/components/article-renderer", () => ({
  ArticleRenderer: class {
    async render(body: HTMLElement): Promise<void> {
      body.createDiv({
        cls: "rss-reader-article-content",
        text: "Article text",
      });
    }
    disposePreview(): void {}
  },
}));

const views: RssDashboardView[] = [];
async function surface() {
  const app: App = App.createMock();
  app.workspace = {
    on: vi.fn(),
    offref: vi.fn(),
    getLeavesOfType: () => [],
    onLayoutReady: vi.fn(),
  } as unknown as App["workspace"];
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.viewStyle = "card";
  settings.display.autoMarkReadOnOpen = false;
  settings.dashellWorkspace = {
    channel: "https://second.example/rss",
    listWidth: 300,
    focused: false,
    channels: {},
  };
  settings.feeds = ["First", "Second"].map((title): Feed => ({
    title,
    url: `https://${title.toLowerCase()}.example/rss`,
    folder: "",
    lastUpdated: 0,
    items: [
      {
        guid: title,
        title,
        feedTitle: title,
        feedUrl: `https://${title.toLowerCase()}.example/rss`,
        link: `https://${title.toLowerCase()}.example/article`,
        pubDate: "2026-10-02",
        description: "Article summary",
        coverImage: "",
        content: "Article text",
      },
    ],
  }));
  const plugin = {
    settings,
    dashellLearning: {
      act: async (work: () => Promise<void>) => work(),
      open: vi.fn(async () => undefined),
    },
    saveSettings: vi.fn(async () => undefined),
    resolveCachedImageUrl: vi.fn(),
  } as unknown as RssDashboardPlugin;
  const view = new RssDashboardView({ app } as unknown as WorkspaceLeaf, plugin);
  views.push(view);
  document.body.appendChild(view.containerEl);
  await view.onOpen();
  return {
    view,
    settings,
    home: view.containerEl.querySelector<HTMLElement>(".rss-dashboard-layout")!,
    plugin,
  };
}

beforeEach(() => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
});

afterEach(async () => {
  for (const view of views.splice(0)) await view.onClose();
  document.body.empty();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Dashboard and reading page navigation", () => {
  it("opens the original dashboard even when a reading channel was previously remembered", async () => {
    const { view, home } = await surface();
    expect(home.hidden).toBe(false);
    expect(
      home.querySelector(".rss-dashboard-sidebar-container"),
    ).not.toBeNull();
    expect(view.containerEl.querySelector(".rss-workbench")).toBeNull();
    expect(
      view.containerEl.classList.contains("rss-dashell-workbench-view"),
    ).toBe(false);
  });

  it("filters the existing dashboard when a subscription is clicked", async () => {
    const { view, settings, home } = await surface();
    view.containerEl
      .querySelector<HTMLElement>(`[data-feed-url="${settings.feeds[0].url}"]`)!
      .click();
    expect(home.hidden).toBe(false);
    expect(view.containerEl.querySelector(".rss-workbench")).toBeNull();
    expect((view as unknown as { currentFeed: Feed }).currentFeed).toBe(settings.feeds[0]);
  });

  it("hands a card to Reader while preserving the RSS home and its feed filter", async () => {
    const { view, settings, home, plugin } = await surface();
    const api = view as unknown as {
      handleArticleClick(item: Feed["items"][number]): Promise<void>;
      currentFeed: Feed | null;
    };
    api.currentFeed = settings.feeds[0];
    await api.handleArticleClick(settings.feeds[1].items[0]);
    expect(home.hidden).toBe(false);
    expect(view.containerEl.querySelector(".rss-workbench")).toBeNull();
    expect(plugin.dashellLearning?.open).toHaveBeenCalledWith(
      settings.feeds[1].items[0], expect.any(Function), expect.any(Function),
    );
    expect(api.currentFeed).toBe(settings.feeds[0]);
    expect(settings.feeds[1].items[0].read).not.toBe(true);
  });

  it("keeps Ctrl-click feed selection on the dashboard", async () => {
    const { view, settings, home } = await surface();
    view.containerEl
      .querySelector<HTMLElement>(`[data-feed-url="${settings.feeds[0].url}"]`)!
      .dispatchEvent(new MouseEvent("click", { ctrlKey: true, bubbles: true }));
    expect(home.hidden).toBe(false);
    expect(view.containerEl.querySelector(".rss-workbench")).toBeNull();
    expect(view.selectedFeeds).toEqual([settings.feeds[0].url]);
  });
});
