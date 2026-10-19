import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestUrlResponse } from "obsidian";
import * as obsidian from "obsidian";
import {
  loadFeedForPreview,
  parseFeedPreviewFromXmlText,
} from "../../../../src/services/feed-parser/feed-preview.js";
import { JSON_FEED_BASIC } from "./fixtures/rss-fixtures.js";
import { FeedChoicesError } from "../../../../src/services/feed-parser/feed-source";

function mockRequestUrlResponse(text: string): RequestUrlResponse {
  const bytes = new TextEncoder().encode(text);
  return {
    text,
    status: 200,
    headers: { "content-type": "application/feed+json" },
    arrayBuffer: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
    json: {},
  };
}

describe("feed preview parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("escapes bare ampersands so preview detects entries", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <description>AI & Data Science</description>
    <link>https://example.com</link>
    <item>
      <title>First</title>
      <link>https://example.com/first</link>
      <guid>https://example.com/first</guid>
      <pubDate>Fri, 13 Mar 2026 12:45:44 GMT</pubDate>
      <description>Hello</description>
    </item>
  </channel>
</rss>`;

    const parsed = parseFeedPreviewFromXmlText(xml, "https://example.com/rss.xml");
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Example Feed");
    expect(parsed?.hasEntries).toBe(true);
    expect(parsed?.latestPubDate).toContain("2026");
  });

  it("returns null for empty xml text", () => {
    expect(parseFeedPreviewFromXmlText("", "https://example.com/feed.xml")).toBeNull();
  });

  it("keeps the validated feed document for adding without downloading it again", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce(mockRequestUrlResponse(JSON_FEED_BASIC));
    const preview = await loadFeedForPreview("https://example.com/feed.json");
    expect(preview).toHaveProperty("source.text", JSON_FEED_BASIC);
    expect(preview).toHaveProperty("source.url", "https://example.com/feed.json");
  });

  it("discovers a declared head feed without depending on file suffix or MIME", async () => {
    vi.spyOn(obsidian, "requestUrl")
      .mockResolvedValueOnce(mockRequestUrlResponse('<html><head><link href="/updates" type="application/feed+json" rel="alternate"></head><body><a href="/feed">Ignore</a></body></html>'))
      .mockResolvedValueOnce(mockRequestUrlResponse(JSON_FEED_BASIC));
    const preview = await loadFeedForPreview("https://example.com/");
    expect(preview.feedUrl).toBe("https://example.com/updates");
    expect(preview.title).toBe("JSON Feed");
    expect(obsidian.requestUrl).toHaveBeenCalledTimes(2);
  });

  it("loads title and latest entry from a JSON Feed", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce(
      mockRequestUrlResponse(JSON_FEED_BASIC),
    );

    const preview = await loadFeedForPreview("https://example.com/feed.json");

    expect(preview).toMatchObject({
      title: "JSON Feed",
      hasEntries: true,
      latestPubDate: "2024-01-01T00:00:00Z",
      feedUrl: "https://example.com/feed.json",
    });
    expect(obsidian.requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining("application/feed+json"),
        }),
      }),
    );
  });

  it.each([
    '<!DOCTYPE rss [<!ENTITY x "unsafe">]><rss><channel><title>&x;</title></channel></rss>',
    '<not-a-feed><rss><channel/></rss></not-a-feed>',
    '<rss><channel></rss>',
    "x".repeat(5 * 1024 * 1024 + 1),
  ])("rejects unsafe or malformed sources without relaying them to a proxy", async (text) => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValue(mockRequestUrlResponse(text));
    await expect(loadFeedForPreview("https://example.com/source")).rejects.toThrow();
    expect(obsidian.requestUrl).toHaveBeenCalledTimes(1);
  });

  it("recognizes OPML by its content at an extensionless URL", async () => {
    const text = '<opml version="2.0"><body><outline text="News" xmlUrl="https://example.com/feed"/></body></opml>';
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce(mockRequestUrlResponse(text));
    await expect(loadFeedForPreview("https://example.com/subscriptions")).rejects.toMatchObject({ content: text });
    expect(obsidian.requestUrl).toHaveBeenCalledTimes(1);
  });

  it("offers all valid declared feeds and retains their bodies for the user's choice", async () => {
    vi.spyOn(obsidian, "requestUrl")
      .mockResolvedValueOnce(mockRequestUrlResponse('<html><head><base href="/news/"><link rel="alternate" type="application/feed+json" href="one"><link href="two" rel="alternate" type="application/feed+json"><link rel="alternate" type="application/rss+xml" href="javascript:alert(1)"></head></html>'))
      .mockResolvedValue(mockRequestUrlResponse(JSON_FEED_BASIC));
    const error: unknown = await loadFeedForPreview("https://example.com/").catch(value => value);
    expect(error).toBeInstanceOf(FeedChoicesError);
    if (!(error instanceof FeedChoicesError)) throw new Error("Expected source choices");
    expect(error.feeds.map(feed => feed.feedUrl)).toEqual(["https://example.com/news/one", "https://example.com/news/two"]);
    expect(error.feeds.every(feed => feed.source?.text === JSON_FEED_BASIC)).toBe(true);
    expect(obsidian.requestUrl).toHaveBeenCalledTimes(3);
  });

  it("requires explicit choice if one of the declared feeds could not be checked", async () => {
    vi.spyOn(obsidian, "requestUrl")
      .mockResolvedValueOnce(mockRequestUrlResponse('<html><head><link rel="alternate" type="application/feed+json" href="/one"><link rel="alternate" type="application/rss+xml" href="/two"></head></html>'))
      .mockResolvedValueOnce(mockRequestUrlResponse(JSON_FEED_BASIC))
      .mockResolvedValueOnce(mockRequestUrlResponse("<not-feed/>"));
    await expect(loadFeedForPreview("https://example.com/")).rejects.toMatchObject({ failed: 1, feeds: [expect.objectContaining({ feedUrl: "https://example.com/one" })] });
  });

  it("stops discovery after cancellation without sending fallback requests", async () => {
    const controller = new AbortController();
    vi.spyOn(obsidian, "requestUrl").mockImplementationOnce(() => {
      controller.abort();
      const response = mockRequestUrlResponse(JSON_FEED_BASIC);
      return Object.assign(Promise.resolve(response), { text: Promise.resolve(response.text), json: Promise.resolve(response.json), arrayBuffer: Promise.resolve(response.arrayBuffer) });
    });
    await expect(loadFeedForPreview("https://example.com/feed", "auto", controller.signal)).rejects.toThrow("cancelled");
    expect(obsidian.requestUrl).toHaveBeenCalledTimes(1);
  });
});
