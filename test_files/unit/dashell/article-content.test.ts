import { describe, expect, it, vi } from "vitest";
import { articleContent } from "../../../src/dashell/article-content";
import { fetchFullArticleContentWithOutcome } from "../../../src/utils/full-article-fetch";
import type { FeedItem } from "../../../src/types/types";

vi.mock("../../../src/utils/full-article-fetch", () => ({
  fetchFullArticleContentWithOutcome: vi.fn(),
}));

const item: FeedItem = {
  title: "Article",
  guid: "one",
  feedTitle: "Feed",
  pubDate: "",
  coverImage: "",
  feedUrl: "https://example.com/rss",
  link: "https://example.com/article",
  description: "<p>Feed excerpt.</p>",
};
const fetch = vi.mocked(fetchFullArticleContentWithOutcome);

describe("Article content for the learning reader", () => {
  it("uses a complete material feed without fetching a different page", async () => {
    fetch.mockClear();
    expect(
      await articleContent({ ...item, dashell: { id: "curated" } }, document),
    ).toBe(item.description);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("replaces a feed excerpt with the longer extracted article", async () => {
    const content = `<p>${"Complete article text. ".repeat(30)}</p>`;
    fetch.mockResolvedValue({ content, failureType: "none" });
    expect(await articleContent(item, document, "https://proxy.example/")).toBe(
      content,
    );
    expect(fetch).toHaveBeenLastCalledWith(item.link, "https://proxy.example/");
  });

  it.each(["network", "restricted"] as const)(
    "keeps the available feed text after a %s failure",
    async (failureType) => {
      fetch.mockResolvedValue({ content: "", failureType });
      expect(await articleContent(item, document)).toBe(item.description);
    },
  );

  it("accepts a short extracted article when the feed has no text", async () => {
    const content = "<p>A brief but complete article.</p>";
    fetch.mockResolvedValue({ content, failureType: "none" });
    expect(await articleContent({ ...item, description: "" }, document)).toBe(
      content,
    );
  });

  it("reports missing and restricted text instead of importing an empty file", async () => {
    fetch.mockResolvedValue({ content: "", failureType: "restricted" });
    await expect(
      articleContent({ ...item, description: "" }, document),
    ).rejects.toThrow("受限");
    fetch.mockResolvedValue({ content: "", failureType: "network" });
    await expect(
      articleContent(
        { ...item, description: "<script>alert(1)</script>" },
        document,
      ),
    ).rejects.toThrow("没有提供正文");
  });
});
