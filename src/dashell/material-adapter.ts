import type { FeedItem } from "../types/types";
import type { Asset, Kind, Material } from "./model";
import { safeUrl, stableId, extensionFor, UserError } from "./safety";

function kindFor(assets: Asset[], item: FeedItem): Kind {
  const extension = assets.find((asset) => asset.role === "main")?.extension;
  if (extension && ["mp3", "m4a", "wav", "ogg", "flac"].includes(extension))
    return "audio";
  if (extension && ["mp4", "webm", "mov", "mkv"].includes(extension))
    return "video";
  if (extension) return "book";
  if (item.mediaType === "video") return "video";
  if (item.mediaType === "podcast") return "audio";
  return "article";
}
function assetsFor(item: FeedItem): Asset[] {
  const assets = (item.dashell?.assets ?? []).map((asset) => {
    const url = safeUrl(asset.url, item.feedUrl);
    if (!url) throw new UserError("素材包中有无效下载链接。");
    return { ...asset, url };
  });
  if (!assets.length) {
    const raw = item.enclosure?.url || item.audioUrl || item.videoUrl;
    if (raw) {
      const url = safeUrl(raw, item.feedUrl);
      if (!url) throw new UserError("素材下载链接无效。");
      assets.push({
        url,
        extension: extensionFor(url, item.enclosure?.type),
        role: "main",
        required: true,
      });
    }
  }
  return assets;
}
export async function materialFor(item: FeedItem): Promise<Material> {
  const metadata = item.dashell;
  const link = safeUrl(item.link, item.feedUrl) ?? "";
  const id = await stableId(
    metadata?.id || link || `${item.feedUrl}\n${item.guid || item.title}`,
  );
  const assets = assetsFor(item);
  const kind = kindFor(assets, item);
  if ((kind === "audio" || kind === "video") && !assets.length)
    throw new UserError("这个来源没有提供可直接下载的音视频文件。");
  return {
    id,
    title: item.title,
    link,
    content: item.content || item.description || "",
    published: item.pubDate,
    language: metadata?.language ?? "",
    level: metadata?.level ?? "",
    kind,
    assets,
    translation: metadata?.translation,
    rewrite: metadata?.rewrite,
    sessions: [],
    download: "idle",
  };
}
