import type { ParsedFeed, ParsedItem } from "../types.js";
import { sanitizeCDATA, stripTitleFormattingTags } from "./xml-html-utils";

const ATOM_NAMESPACE = "http://www.w3.org/2005/Atom";
const MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/";
export interface AtomParserDeps {
  getTextContent: (element: Element | null, tagName: string, isHtml?: boolean) => string;
  getAttribute: (element: Element | null, tagName: string, attribute: string) => string;
  transformSageUrl: (url: string) => string;
}

/** Atom fields are direct children in the Atom namespace, never media attachments. */
function children(node: Element, name: string): Element[] {
  return Array.from(node.children).filter(child =>
    child.localName === name && child.namespaceURI === node.namespaceURI,
  );
}
function child(node: Element, name: string): Element | undefined {
  return children(node, name)[0];
}
function text(node: Element, name: string): string {
  return sanitizeCDATA(child(node, name)?.textContent?.trim() ?? "");
}
function author(node: Element): string {
  const value = child(node, "author");
  return value ? text(value, "name") : "";
}
function media(node: Element, name: string): Element | undefined {
  return Array.from(node.getElementsByTagNameNS(MEDIA_NAMESPACE, name))[0];
}
export function atomRoot(doc: Document): Element | undefined {
  const root = doc.documentElement;
  return root?.localName === "feed" && (!root.namespaceURI || root.namespaceURI === ATOM_NAMESPACE)
    ? root : undefined;
}
export function getAtomEntryLink(entry: Element): string {
  const links = children(entry, "link").filter(link => link.getAttribute("href"));
  const preferred = links.find(link => link.getAttribute("rel") === "alternate" && link.getAttribute("type") === "text/html")
    ?? links.find(link => link.getAttribute("rel") === "alternate")
    ?? links.find(link => !link.getAttribute("rel")) ?? links[0];
  return preferred?.getAttribute("href") ?? "";
}
function content(entry: Element): string {
  const element = child(entry, "content") ?? child(entry, "summary");
  if (!element) return "";
  if (element.getAttribute("type") === "xhtml") {
    const wrapper = element.firstElementChild;
    return wrapper ? Array.from(wrapper.childNodes).map(node => new XMLSerializer().serializeToString(node)).join("") : "";
  }
  return sanitizeCDATA(element.textContent?.trim() ?? "", true);
}
function parseEntry(entry: Element, deps: AtomParserDeps): ParsedItem {
  const link = deps.transformSageUrl(getAtomEntryLink(entry));
  const description = text(entry, "summary") || media(entry, "description")?.textContent || "";
  return {
    title: stripTitleFormattingTags(text(entry, "title")), link, description,
    pubDate: text(entry, "published") || text(entry, "updated"),
    guid: text(entry, "id") || link, author: author(entry),
    content: content(entry) || description,
    category: children(entry, "category").map(category => category.getAttribute("term") || category.textContent || "").join(", "),
    itunes: { duration: deps.getTextContent(entry, "itunes\\:duration") || media(entry, "content")?.getAttribute("duration") || undefined },
  };
}
export function parseAtom(doc: Document, deps: AtomParserDeps): ParsedFeed {
  const feed = atomRoot(doc);
  if (!feed) throw new Error("Invalid atom feed: no feed element found");
  const entries = children(feed, "entry");
  const imageUrl = Array.from(feed.children).find(node => node.namespaceURI === MEDIA_NAMESPACE && node.localName === "thumbnail")?.getAttribute("url")
    || text(feed, "logo") || text(feed, "icon")
    || (entries[0] && media(entries[0], "thumbnail")?.getAttribute("url")) || "";
  return {
    title: text(feed, "title"), description: text(feed, "subtitle"),
    link: getAtomEntryLink(feed), author: author(feed),
    image: imageUrl ? { url: imageUrl } : undefined,
    items: entries.map(entry => parseEntry(entry, deps)), type: "atom",
    feedItunesImage: "", feedImageUrl: imageUrl,
  };
}
