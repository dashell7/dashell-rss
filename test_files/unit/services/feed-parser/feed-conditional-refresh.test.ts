import { afterEach, expect, it, vi } from "vitest";
import { requestUrl, type RequestUrlResponse } from "obsidian";
import * as obsidian from "obsidian";
import { FeedParser } from "../../../../src/services/feed-parser/feed-parser-class";
import { DEFAULT_SETTINGS } from "../../../../src/types/types";
import { RSS2_BASIC } from "./fixtures/rss-fixtures";

afterEach(() => vi.restoreAllMocks());

function response(status: number, headers: Record<string, string> = {}): RequestUrlResponse {
  const text = status === 304 ? "" : RSS2_BASIC;
  const bytes = new TextEncoder().encode(text);
  return { status, headers, text, json: {}, arrayBuffer: bytes.buffer };
}

it("uses server validators and keeps cached articles and their state on HTTP 304", async () => {
  vi.spyOn(obsidian, "requestUrl")
    .mockResolvedValueOnce(response(200, { ETag: '"feed-v1"', "Last-Modified": "Wed, 07 Oct 2026 00:00:00 GMT" }))
    .mockResolvedValueOnce(response(304));
  const parser = new FeedParser(DEFAULT_SETTINGS.display, [], undefined, () => [], () => false);
  const cached = await parser.parseFeed("https://example.org/feed.xml");
  cached.items[0].read = true;
  cached.items[0].starred = true;
  const articles = cached.items;
  const refreshed = await parser.parseFeed(cached.url, cached);
  expect(requestUrl).toHaveBeenNthCalledWith(2, expect.objectContaining({
    headers: expect.objectContaining({
      "If-None-Match": '"feed-v1"', "If-Modified-Since": "Wed, 07 Oct 2026 00:00:00 GMT",
    }),
  }));
  expect(refreshed.items).toBe(articles);
  expect(refreshed.items[0]).toMatchObject({ read: true, starred: true });
  expect(refreshed.etag).toBe('"feed-v1"');
});

it("clears obsolete validators when a changed feed stops sending them", async () => {
  vi.spyOn(obsidian, "requestUrl")
    .mockResolvedValueOnce(response(200, { ETag: '"feed-v1"' }))
    .mockResolvedValueOnce(response(200));
  const parser = new FeedParser(DEFAULT_SETTINGS.display, [], undefined, () => [], () => false);
  const cached = await parser.parseFeed("https://example.org/feed.xml");
  expect(cached.etag).toBe('"feed-v1"');
  const refreshed = await parser.parseFeed(cached.url, cached);
  expect(refreshed.etag).toBeUndefined();
  expect(refreshed.items).not.toHaveLength(0);
});
