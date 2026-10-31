import { robustFetchDetailed } from "../utils/platform-utils";

function declaredImageUrl(value: unknown, base: string): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value, base).href;
    return isCoverPageUrl(url) ? url : "";
  } catch { return ""; }
}

/** Only image declarations are followed; author/avatar and body images are ignored. */
function schemaImage(value: unknown, base: string, depth = 0): string {
  if (depth > 4) return "";
  if (typeof value === "string") return declaredImageUrl(value, base);
  if (Array.isArray(value)) {
    for (const entry of value.slice(0, 32)) {
      const url = schemaImage(entry, base, depth + 1);
      if (url) return url;
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return schemaImage(record.contentUrl ?? record.url, base, depth + 1);
  }
  return "";
}

function jsonLdCover(doc: Document, base: string): string {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(0, 20)) {
    try {
      const pending: unknown[] = [JSON.parse(script.textContent ?? "")];
      for (let visited = 0; pending.length && visited < 100; visited++) {
        const node = pending.shift();
        if (Array.isArray(node)) { pending.push(...(node as unknown[]).slice(0, 32)); continue; }
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
        if (types.some(type => ["Article", "NewsArticle", "BlogPosting", "DiscussionForumPosting"].includes(String(type)))) {
          const image = schemaImage(record.image, base);
          if (image) return image;
        }
        pending.push(record["@graph"], record.mainEntity);
      }
    } catch { /* Another script can still declare an image. */ }
  }
  return "";
}

export function isCoverPageUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

/** Read the page head once through the existing shared transport budget. */
export async function fetchPageCover(link: string): Promise<string> {
  if (!isCoverPageUrl(link)) return "";
  const response = await robustFetchDetailed(link, { priority: 1 });
  if (response.status < 200 || response.status >= 300) return "";
  const start = response.text.slice(0, 256 * 1024);
  const close = /<\/head\s*>/i.exec(start);
  const head = close ? start.slice(0, close.index) : start;
  const doc = new DOMParser().parseFromString(head, "text/html");
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[property="twitter:image"]']) {
    const value = doc.querySelector(selector)?.getAttribute("content");
    if (!value) continue;
    const url = declaredImageUrl(value, link);
    if (url) return url;
  }
  return jsonLdCover(doc, link);
}
