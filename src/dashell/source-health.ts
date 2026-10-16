import type { Feed } from "../types/types";
export function sourceHealth(feed: Feed, now = Date.now()) {
  return {
    cached: feed.items.length,
    read: feed.items.filter(item => item.read).length,
    opened: feed.items.filter(item => (item.lastOpenedAt ?? 0) > 0).length,
    opened30d: feed.items.filter(item => (item.lastOpenedAt ?? 0) > 0 && (item.lastOpenedAt ?? 0) >= now - 30 * 86400000).length,
    later: feed.items.filter(item => item.readLaterAt).length,
    paused: feed.excludeFromRefresh === true || feed.scanInterval === -1,
    error: feed.lastFetchError ?? "",
  };
}
