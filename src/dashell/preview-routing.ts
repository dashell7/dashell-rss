import type { FeedItem } from "../types/types";
import { isLikelyVideoItem } from "../utils/video-detection";

const mediaExtensions = new Set(["mp3", "m4a", "wav", "ogg", "flac", "mp4", "webm", "mov", "mkv"]);

/** Media previews stay usable even when no downloadable source or learning plugin exists. */
export function usesRssMediaPreview(item: FeedItem): boolean {
  return item.mediaType === "podcast" || isLikelyVideoItem(item)
    || !!(item.audioUrl || item.videoUrl || item.videoId)
    || /^(audio|video)\//i.test(item.enclosure?.type ?? "")
    || item.mediaContentType?.startsWith("audio/") === true
    || item.dashell?.assets?.some(asset => asset.role === "main" && mediaExtensions.has(asset.extension.toLowerCase())) === true;
}
