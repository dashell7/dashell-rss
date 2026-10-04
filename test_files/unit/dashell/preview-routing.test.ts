import { describe, expect, it } from "vitest";
import type { FeedItem } from "../../../src/types/types";
import { usesRssMediaPreview } from "../../../src/dashell/preview-routing";

const item: FeedItem = {
  title: "A source", guid: "source", link: "https://example.com/article",
  description: "", pubDate: "", feedTitle: "Feed", feedUrl: "https://example.com/rss", coverImage: "",
};
describe("RSS preview routing", () => {
  it.each([
    { mediaType: "podcast" }, { mediaType: "video" },
    { audioUrl: "https://example.com/file.mp3" }, { videoId: "video-id" },
    { mediaContentType: "video/mp4" }, { mediaContentType: "audio/mpeg" },
    { enclosure: { url: "https://example.com/stream", type: "audio/mpeg", length: "0" } },
    { dashell: { assets: [{ role: "main", extension: "mp4", url: "https://example.com/file.mp4", required: true }] } },
    { link: "https://example.com/news/videos/episode" },
  ] satisfies Partial<FeedItem>[])("previews media identified by %j without requiring a download URL", media => {
    const source = { ...item, ...media };
    const before = structuredClone(source);
    expect(usesRssMediaPreview(source)).toBe(true);
    expect(source).toEqual(before);
  });
  it("keeps text, books and articles with incidental media mentions on the learning path", () => {
    expect(usesRssMediaPreview(item)).toBe(false);
    expect(usesRssMediaPreview({ ...item, description: "<p>A review of a podcast.</p>" })).toBe(false);
    expect(usesRssMediaPreview({ ...item, dashell: { assets: [{ role: "main", extension: "epub", url: "https://example.com/book.epub", required: true }] } })).toBe(false);
  });
});
