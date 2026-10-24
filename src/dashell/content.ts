// Adapted from Qiaomu AI RSS src/content.ts at ac2c792 (GPL-3.0-only).
// Copyright (c) 向阳乔木. Changes: independent material contract and optional images.
// Rewrite image recovery adapted from upstream 22f5509 (GPL-3.0-only).
import createDOMPurify from "dompurify";
import { Marked } from "marked";
import { safeUrl } from "./safety";
import type { Mode } from "./model";
import { normalizeWechatArticleLinks } from "../utils/wechat-article-links";

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Keep recovery local to rewrite Markdown; ordinary inline Markdown and code
// remain under Marked's standard tokenizer, followed by our existing sanitizer.
const rewriteMarkdown = new Marked({
  extensions: [{
    name: "recoveredImage",
    level: "block",
    tokenizer(source) {
      const match = /^ {0,3}!\[([^\n]*)\]\((https?:\/\/[^\s<>]+)\)[ \t]*(?:\n|$)/.exec(source);
      const alt = match?.[1];
      const href = match?.[2];
      if (!match || alt === undefined || href === undefined) return;
      let depth = 0;
      for (let index = 0; index < alt.length; index++) {
        if (alt[index] === "\\") { index++; continue; }
        if (alt[index] === "[") depth++;
        if (alt[index] === "]") depth--;
      }
      if (depth <= 0) return;
      return { type: "recoveredImage", raw: match[0], href, text: alt };
    },
    renderer(token) {
      return `<p><img src="${escapeAttribute(String(token.href))}" alt="${escapeAttribute(String(token.text))}"></p>\n`;
    },
  }],
});

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
    mode === "rewrite" ? rewriteMarkdown.parse(content, { async: false }) : content;
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
  normalizeWechatArticleLinks(fragment);
  return fragment;
}
