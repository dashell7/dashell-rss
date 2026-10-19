import createDOMPurify from "dompurify";
import type { FeedPreviewData } from "./types";

/** Adapted from Qiaomu AI RSS 0.30.0 source resolution; see NOTICE.md. */
export class SourceDocumentError extends Error {}
export class OpmlSourceError extends SourceDocumentError {
  constructor(readonly content: string) { super("This link contains an OPML subscription list."); }
}
export class FeedChoicesError extends SourceDocumentError {
  constructor(readonly feeds: FeedPreviewData[], readonly failed: number) {
    super("Choose a feed to add.");
  }
}

export function sourceHttpUrl(raw: string, base?: string): string {
  try {
    const url = new URL(raw, base);
    if (url.protocol === "https:" || url.protocol === "http:") {
      url.hash = "";
      return url.href;
    }
  } catch { /* The user gets a safe message without private URL parameters. */ }
  throw new SourceDocumentError("Enter an HTTP or HTTPS address.");
}

/** Inspect actual content, independent of MIME or filename; never expand DTDs. */
export function sourceDocumentKind(text: string): "feed" | "html" | "opml" {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024) {
    throw new SourceDocumentError("The source is larger than 5 MB.");
  }
  if (/<!ENTITY\b/i.test(text) || /<!DOCTYPE\s+(?!html\s*>)/i.test(text)) {
    throw new SourceDocumentError("XML document types and entities are not supported.");
  }
  const start = text.trimStart();
  if (start.startsWith("{")) return "feed";
  if (/^(?:<!doctype\s+html\s*>\s*)?<(?:html|head)\b/i.test(start)) return "html";
  const escaped = text.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
  const doc = new DOMParser().parseFromString(escaped, "text/xml");
  if (doc.querySelector("parsererror")) throw new SourceDocumentError("The source contains invalid XML.");
  const root = doc.documentElement;
  if (root?.localName.toLowerCase() === "opml" && root.querySelector(":scope > body")) return "opml";
  if (["rss", "feed", "rdf"].includes(root?.localName.toLowerCase() ?? "")) return "feed";
  throw new SourceDocumentError("No RSS, Atom, JSON Feed or OPML content found.");
}

/** Only declared alternate links in a sanitized head; no crawling or guessing. */
export function declaredFeedUrls(text: string, pageUrl: string): string[] {
  const html = createDOMPurify(activeDocument.defaultView!).sanitize(text, {
    WHOLE_DOCUMENT: true, RETURN_DOM: true,
    ALLOWED_TAGS: ["html", "head", "link", "base"],
    ALLOWED_ATTR: ["href", "rel", "type"],
  }) as HTMLElement;
  let base = pageUrl;
  const declaredBase = html.querySelector("head base[href]")?.getAttribute("href");
  if (declaredBase) {
    try { base = sourceHttpUrl(declaredBase, pageUrl); } catch { /* Keep page URL. */ }
  }
  const urls = new Set<string>();
  for (const link of html.querySelectorAll("head link[href]")) {
    if (!link.getAttribute("rel")?.toLowerCase().split(/\s+/).includes("alternate")) continue;
    const type = (link.getAttribute("type") ?? "").toLowerCase().split(";")[0]?.trim();
    if (!["application/rss+xml", "application/atom+xml", "application/rdf+xml", "application/feed+json"].includes(type ?? "")) continue;
    try { urls.add(sourceHttpUrl(link.getAttribute("href") ?? "", base)); } catch { continue; }
    if (urls.size >= 8) break;
  }
  return [...urls];
}
