import { afterEach, describe, expect, it, vi } from "vitest";
import * as obsidian from "obsidian";
import { FeedParser } from "../../../../src/services/feed-parser/feed-parser-class";
import { DEFAULT_SETTINGS, type Feed } from "../../../../src/types/types";
import { JSON_FEED_BASIC } from "./fixtures/rss-fixtures";

afterEach(() => vi.restoreAllMocks());
describe("adding a previewed source", () => {
  it("runs the existing item pipeline and retains the chosen settings without another request", async () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    const parser = new FeedParser(settings.display, [{ name: "English", color: "#222222" }], settings.media);
    const request = vi.spyOn(obsidian, "requestUrl");
    const feed: Feed = { title: "My chosen title", url: "https://example.com/feed", folder: "Learning", items: [], lastUpdated: 0, maxItemsLimit: 10, autoDeleteDuration: 0, customTags: ["English"] };
    const result = await parser.parseFeed(feed.url, feed, { allowEmpty: true, source: { url: feed.url, text: JSON_FEED_BASIC, headers: { ETag: "preview-1" } } });
    expect(request).not.toHaveBeenCalled();
    expect(result).toMatchObject({ title: "My chosen title", folder: "Learning", maxItemsLimit: 10, autoDeleteDuration: 0, etag: "preview-1" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.content).toContain("Item content");
    expect(result.items[0]?.tags).toContainEqual({ name: "English", color: "#222222" });
  });
});
