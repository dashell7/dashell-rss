import type { ParsedFeed } from "../services/feed-parser/types";
import { record, readAsset, string, type SourceMetadata } from "./model";
import { safeUrl } from "./safety";

const namespace = "https://dashell.app/rss/1";
function optionalString(value: unknown, max = 1000000): string | undefined {
  return value === undefined || value === null || value === ""
    ? undefined
    : string(value, max);
}
export function readMetadata(value: unknown): SourceMetadata {
  const data = record(value);
  const metadata: SourceMetadata = {
    id: optionalString(data.id, 1000),
    language: optionalString(data.language, 100),
    level: optionalString(data.level, 100),
    translation: optionalString(data.translation),
    rewrite: optionalString(data.rewrite),
  };
  if (data.assets !== undefined) {
    if (!Array.isArray(data.assets) || data.assets.length > 20)
      throw new Error("Invalid learning bundle");
    metadata.assets = data.assets.map((value) => {
      const asset = record(value);
      const url = string(asset.url, 8000);
      const resolved = safeUrl(url, "https://relative.invalid/");
      if (!resolved) throw new Error("Invalid asset URL");
      return { ...readAsset({ ...asset, url: resolved }), url };
    });
    if (
      metadata.assets.length &&
      metadata.assets.filter((asset) => asset.role === "main").length !== 1
    )
      throw new Error("Bundle must have one main file");
    const paths = metadata.assets.map(
      (asset) =>
        `${asset.role === "transcript" ? "transcript" : "material"}.${asset.extension}`,
    );
    if (new Set(paths).size !== paths.length)
      throw new Error("Duplicate asset target");
  }
  return metadata;
}
function xmlMetadata(element: Element): SourceMetadata | undefined {
  if (!element.getElementsByTagNameNS(namespace, "*").length) return undefined;
  const text = (key: string) =>
    element.getElementsByTagNameNS(namespace, key)[0]?.textContent?.trim();
  return readMetadata({
    id: text("id"),
    language: text("language"),
    level: text("level"),
    translation: text("translation"),
    rewrite: text("rewrite"),
    assets: Array.from(element.getElementsByTagNameNS(namespace, "asset")).map(
      (asset) => ({
        url: asset.getAttribute("url"),
        role: asset.getAttribute("role") || "main",
        extension: asset.getAttribute("extension"),
        required: asset.getAttribute("required") !== "false",
        ...(asset.hasAttribute("bytes")
          ? { bytes: Number(asset.getAttribute("bytes")) }
          : {}),
      }),
    ),
  });
}
export function attachMetadata(feed: ParsedFeed, text: string): ParsedFeed {
  if (!text.includes(namespace) && !text.includes('"_dashell"')) return feed;
  let values: (SourceMetadata | undefined)[];
  if (text.trim().startsWith("{")) {
    const data = record(JSON.parse(text) as unknown);
    if (!Array.isArray(data.items)) return feed;
    values = data.items.map((value) => {
      const item = record(value);
      return item._dashell ? readMetadata(item._dashell) : undefined;
    });
  } else {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const elements = Array.from(doc.getElementsByTagName("*")).filter(
      (el) =>
        ["item", "entry"].includes(el.localName) &&
        ["channel", "feed"].includes(el.parentElement?.localName ?? ""),
    );
    values = elements.map(xmlMetadata);
  }
  for (const [index, item] of feed.items.entries())
    if (values[index]) item.dashell = values[index];
  return feed;
}
