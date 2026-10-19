import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedSubscriptionService, type FeedSubscriptionServiceOptions } from "../../../src/services/feed-subscription-service";
import { DEFAULT_SETTINGS, type Feed } from "../../../src/types/types";

function harness() {
  const settings = structuredClone(DEFAULT_SETTINGS);
  const parseFeed = vi.fn<(_url: string, feed: Feed) => Promise<Feed>>(async (_url, feed) => ({ ...feed, items: [] }));
  const save = vi.fn(async () => {});
  const refresh = vi.fn();
  const warm = vi.fn();
  const tracker = { isCancelled: false, isDisposed: false };
  const options = {
    getSettings: () => settings, getFeedParser: () => ({ parseFeed }),
    saveSettings: save, ensureFolderExists: vi.fn(async () => true),
    getActiveDashboardView: vi.fn(async () => ({ refresh })),
    previewImageCache: { warmFeed: warm }, feedOperationTracker: tracker,
  } as unknown as FeedSubscriptionServiceOptions;
  return { settings, parseFeed, save, refresh, warm, tracker, service: new FeedSubscriptionService(options) };
}
afterEach(() => vi.restoreAllMocks());
describe("subscription commit reliability", () => {
  it("removes a failed addition so it can be retried without deleting another source", async () => {
    const h = harness();
    h.save.mockRejectedValueOnce(new Error("disk full"));
    expect(await h.service.addFeed("New", "https://example.com/feed", "")).toBe(false);
    expect(h.settings.feeds).toHaveLength(0);
    expect(h.warm).not.toHaveBeenCalled();
    expect(await h.service.addFeed("New", "https://example.com/feed", "")).toBe(true);
    expect(h.settings.feeds).toHaveLength(1);
  });
  it("does not add after the plugin has been disposed during a fetch", async () => {
    const h = harness();
    h.parseFeed.mockImplementation(async (_url, feed) => { h.tracker.isDisposed = true; return feed; });
    expect(await h.service.addFeed("New", "https://example.com/feed", "")).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
    expect(h.settings.feeds).toHaveLength(0);
  });
  it("rechecks subscriptions after parsing to avoid duplicates introduced by another import", async () => {
    const h = harness();
    h.parseFeed.mockImplementation(async (_url, feed) => { h.settings.feeds.push(feed); return { ...feed }; });
    expect(await h.service.addFeed("New", "https://example.com/feed", "")).toBe(false);
    expect(h.settings.feeds).toHaveLength(1);
    expect(h.save).not.toHaveBeenCalled();
  });
  it("keeps a successful durable addition when an optional preview cannot refresh", async () => {
    const h = harness();
    h.warm.mockImplementationOnce(() => { throw new Error("cache unavailable"); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await h.service.addFeed("New", "https://example.com/feed", "")).toBe(true);
    expect(h.settings.feeds).toHaveLength(1);
    expect(h.save).toHaveBeenCalledTimes(1);
  });
});
