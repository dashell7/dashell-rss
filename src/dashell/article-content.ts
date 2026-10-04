import type { FeedItem } from "../types/types";
import { fetchFullArticleContentWithOutcome } from "../utils/full-article-fetch";
import { articleFragment } from "./content";
import { safeUrl, UserError } from "./safety";

export async function articleContent(
  item: FeedItem,
  doc: Document,
  proxy?: string,
): Promise<string> {
  const fallback = item.content || item.description || "";
  const available =
    articleFragment(
      fallback,
      "original",
      doc,
      false,
      item.link,
    ).textContent?.trim() || "";
  // Complete material feeds already carry curated original/translated versions.
  if (item.dashell?.id && available) return fallback;
  const link = safeUrl(item.link, item.feedUrl);
  if (link) {
    const result = await fetchFullArticleContentWithOutcome(link, proxy);
    const text =
      articleFragment(
        result.content,
        "original",
        doc,
        false,
        link,
      ).textContent?.trim() || "";
    if (
      text &&
      (!available || (text.length > available.length && text.length > 200))
    )
      return result.content;
    if (available) return fallback;
    if (result.failureType === "restricted")
      throw new UserError("来源正文受限，请在浏览器中打开原文。");
  }
  if (!available) throw new UserError("这个订阅没有提供正文，请打开来源查看。");
  return fallback;
}
