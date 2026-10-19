import { robustFetchDetailed } from "../../utils/platform-utils.js";
import type { FeedEncoding } from "../../types/types.js";
import { isValidFeed } from "./feed-validation.js";
import { CustomXMLParser } from "./xml-parser/custom-xml-parser.js";
import type { FeedPreviewData, Rss2JsonResponse } from "./types.js";
import { declaredFeedUrls, FeedChoicesError, OpmlSourceError, sourceDocumentKind, SourceDocumentError, sourceHttpUrl } from "./feed-source";

export type { FeedPreviewData } from "./types.js";

const BARE_AMPERSAND_REGEX =
  /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g;
export function parseFeedPreviewFromXmlText(
  xmlText: string,
  feedUrl: string,
): FeedPreviewData | null {
  if (!xmlText) return null;

  const sanitizedXmlText = xmlText.replace(BARE_AMPERSAND_REGEX, "&amp;");
  const doc = new DOMParser().parseFromString(sanitizedXmlText, "text/xml");

  if (doc.querySelector("parsererror")) {
    return null;
  }

  return parseFeedDoc(doc, feedUrl);
}

export async function loadFeedForPreview(
  feedUrl: string,
  feedEncoding?: FeedEncoding,
  signal?: AbortSignal,
): Promise<FeedPreviewData> {
  feedUrl = sourceHttpUrl(feedUrl);
  const current = () => {
    if (signal?.aborted) throw new SourceDocumentError("Preview cancelled. Try loading again.");
  };
  current();
  // Try direct request first
  try {
    const response = await robustFetchDetailed(feedUrl, {
      method: "GET",
      priority: 0,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "application/feed+json, application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      encodingOverride:
        feedEncoding === "windows-1251" ? feedEncoding : undefined,
    });
    current();
    const kind = sourceDocumentKind(response.text);
    if (kind === "opml") throw new OpmlSourceError(response.text);
    if (kind === "html") return await discoverPreview(response.text, feedUrl, feedEncoding, signal);
    const preview = parseFeedPreviewResponse(response.text, feedUrl);
    if (preview) return { ...preview, source: { url: feedUrl, text: response.text, encoding: feedEncoding, headers: response.headers } };
    throw new SourceDocumentError("No readable feed found at this address.");
  } catch (error) {
    current();
    if (error instanceof SourceDocumentError) throw error;
    // Fall through to rss2json
  }
  const preview = await loadFeedPreviewFromRss2Json(feedUrl);
  current();
  return preview;
}

async function discoverPreview(text: string, url: string, encoding?: FeedEncoding, signal?: AbortSignal): Promise<FeedPreviewData> {
  const urls = declaredFeedUrls(text, url);
  if (!urls.length) throw new SourceDocumentError("No declared feed found on this page.");
  const feeds: FeedPreviewData[] = [];
  let failed = 0;
  // Sequential verification shares the existing transport budget and stops after cancellation.
  for (const candidate of urls) {
    if (signal?.aborted) throw new SourceDocumentError("Preview cancelled.");
    try {
      const response = await robustFetchDetailed(candidate, { priority: 0, encodingOverride: encoding });
      if (sourceDocumentKind(response.text) !== "feed") { failed++; continue; }
      const preview = parseFeedPreviewResponse(response.text, candidate);
      if (preview) feeds.push({ ...preview, source: { url: candidate, text: response.text, encoding, headers: response.headers } });
      else failed++;
    } catch { failed++; }
  }
  if (signal?.aborted) throw new SourceDocumentError("Preview cancelled.");
  if (feeds.length === 1 && failed === 0) return feeds[0]!;
  if (feeds.length) throw new FeedChoicesError(feeds, failed);
  throw new SourceDocumentError("No readable feed found on this page.");
}

function parseFeedPreviewResponse(
  responseText: string,
  feedUrl: string,
): FeedPreviewData | null {
  if (!responseText || !isValidFeed(responseText)) return null;

  const parsed = new CustomXMLParser().parseString(responseText);
  return {
      title: parsed.title,
      description: parsed.description || "",
      link: parsed.link || "",
      image: parsed.image?.url || "",
      latestPubDate: parsed.items[0]?.pubDate || "",
      hasEntries: parsed.items.length > 0,
      feedUrl,
  };
}

async function loadFeedPreviewFromRss2Json(
  feedUrl: string,
): Promise<FeedPreviewData> {
  // Fallback to rss2json
  const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;

  try {
    const response = await robustFetchDetailed(rss2jsonUrl, {
      method: "GET",
      priority: 0,
    });

    const data = JSON.parse(response.text) as Rss2JsonResponse;

    if (data.status !== "ok" || !data.feed) {
      throw new Error(data.message || "Failed to load feed");
    }
    return {
      title: data.feed.title || "",
      description: data.feed.description || "",
      link: data.feed.link || "",
      image: data.feed.image || "",
      latestPubDate: data.items?.[0]?.pubDate || "",
      hasEntries: (data.items?.length || 0) > 0,
      feedUrl,
    };
  } catch {
    throw new Error("Unable to load this feed. Please try again.");
  }
}

function parseFeedDoc(doc: Document, feedUrl: string): FeedPreviewData {
  const channel = doc.querySelector("channel") || doc.querySelector("feed");
  const title = channel?.querySelector("title")?.textContent || "";
  const description = channel?.querySelector("description")?.textContent || "";
  const link = channel?.querySelector("link")?.textContent || "";
  const imageEl =
    channel?.querySelector("image > url, itunes\\:image")?.textContent ||
    channel?.querySelector("itunes\\:image")?.getAttribute("href") ||
    "";

  const firstItem = doc.querySelector("item, entry");
  const latestPubDate =
    firstItem?.querySelector("pubDate, published, updated")?.textContent || "";

  return {
    title,
    description,
    link,
    image: imageEl,
    latestPubDate,
    hasEntries: !!firstItem,
    feedUrl,
  };
}
