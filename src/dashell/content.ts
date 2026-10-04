// Adapted from Qiaomu AI RSS src/content.ts at ac2c792 (GPL-3.0-only).
// Copyright (c) 向阳乔木. Changes: independent material contract and optional images.
import createDOMPurify from "dompurify";
import { marked } from "marked";
import { safeUrl } from "./safety";
import type { Mode } from "./model";

const tags = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "b",
  "i",
  "s",
  "del",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "div",
  "span",
  "sup",
  "sub",
];
export function articleFragment(
  content: string,
  mode: Mode,
  doc: Document,
  images: boolean,
  base?: string,
): DocumentFragment {
  const html =
    mode === "rewrite" ? marked.parse(content, { async: false }) : content;
  const win = doc.defaultView;
  if (!win) throw new Error("无法取得阅读窗口。");
  const fragment = createDOMPurify(win).sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: images ? tags : tags.filter((tag) => tag !== "img"),
    ALLOWED_ATTR: ["href", "src", "alt"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  for (const element of fragment.querySelectorAll("a, img")) {
    const attr = element.tagName === "A" ? "href" : "src";
    const raw = element.getAttribute(attr);
    const url = raw ? safeUrl(raw, base) : null;
    if (url) element.setAttribute(attr, url);
    else element.removeAttribute(attr);
    if (element.tagName === "A") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    } else {
      element.setAttribute("loading", "lazy");
      element.setAttribute("referrerpolicy", "no-referrer");
    }
  }
  return fragment;
}
