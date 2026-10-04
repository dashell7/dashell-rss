import { afterEach, describe, expect, it, vi } from "vitest";
import { App, Component } from "obsidian";
import { ArticleRenderer } from "../../../src/components/article-renderer";
import { DEFAULT_SETTINGS, type FeedItem } from "../../../src/types/types";
import { fetchFullArticleContentWithOutcome } from "../../../src/utils/full-article-fetch";

vi.mock("../../../src/utils/full-article-fetch", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../src/utils/full-article-fetch")
  >()),
  fetchFullArticleContentWithOutcome: vi.fn(),
}));

afterEach(() => {
  document.body.empty();
  vi.clearAllMocks();
});

describe("Article preview request ownership", () => {
  it("does not render an obsolete fetch or attach its learning controls after switching", async () => {
    let complete:
      | ((
          value: Awaited<ReturnType<typeof fetchFullArticleContentWithOutcome>>,
        ) => void)
      | undefined;
    vi.mocked(fetchFullArticleContentWithOutcome)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      )
      .mockResolvedValueOnce({ content: "", failureType: "none" });
    const component = new Component();
    const learning = vi.fn(() => () => undefined);
    const renderer = new ArticleRenderer({
      app: App.createMock(),
      component,
      settings: structuredClone(DEFAULT_SETTINGS),
      onArticleSave: vi.fn(),
      onArticleUpdate: vi.fn(),
      onLearningPreview: learning,
    });
    const item: FeedItem = {
      guid: "old",
      title: "Old article",
      feedTitle: "Test",
      feedUrl: "https://example.com/rss",
      link: "https://example.com/old",
      description: "",
      pubDate: "",
      coverImage: "",
      content: "<p>Old content.</p>",
    };
    const oldBody = document.body.createDiv();
    const currentBody = document.body.createDiv();
    const pending = renderer.render(oldBody, item);
    await renderer.render(currentBody, {
      ...item,
      guid: "new",
      title: "New article",
      link: "https://example.com/new",
      content: "<p>New content.</p>",
    });
    complete!({ content: "<p>Late old content.</p>", failureType: "none" });
    await pending;
    expect(oldBody.textContent).toBe("");
    expect(currentBody.textContent).toContain("New content.");
    expect(currentBody.textContent).not.toContain("Late old");
    expect(learning).toHaveBeenCalledOnce();
    renderer.disposePreview();
    component.unload();
  });
});
