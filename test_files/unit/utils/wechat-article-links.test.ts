import { afterEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { articleFragment } from "../../../src/dashell/content";
import { sanitizeAndAppendHtml } from "../../../src/utils/safe-html";
import { ArticleSaver } from "../../../src/services/article-saver";
import type { ArticleSavingSettings, FeedItem } from "../../../src/types/types";
import * as fullArticleFetch from "../../../src/utils/full-article-fetch";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.empty();
});

const original = "https://mp.weixin.qq.com/s?__biz=abc%3D%3D&mid=123&idx=1&sn=def";
const proxy = `https://wechat2rss.bestblogs.dev/link-proxy/?u=${encodeURIComponent(original)}&r=1`;
const html = `<p>Cached article</p><a href="${proxy.replace(/&/g, "&amp;")}"><strong>跳转微信打开</strong></a>`;

function rendered(html: string, kind: "learning" | "rich" | "strict"): DocumentFragment | HTMLElement {
  if (kind === "learning") return articleFragment(html, "original", document, false);
  const container = document.body.createDiv();
  sanitizeAndAppendHtml(container, html, { mode: kind });
  return container;
}

describe.each(["learning", "rich", "strict"] as const)("WeChat original links in %s content", (kind) => {
  it("opens cached proxy links as HTTPS articles without changing their query or cached source", () => {
    const link = rendered(html, kind).querySelector("a");
    expect(link?.getAttribute("href")).toBe(original);
    expect(link?.textContent).toBe("查看公众号原文");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(html).toContain("link-proxy/");
  });

  it("keeps custom labels and accepts short article URLs", () => {
    const target = "https://mp.weixin.qq.com/s/Abc_123-xyz#read";
    const link = rendered(`<a href="https://wechat2rss.bestblogs.dev/link-proxy?u=${encodeURIComponent(target)}"><em>Read this</em></a>`, kind).querySelector("a");
    expect(link?.getAttribute("href")).toBe(target);
    expect(link?.querySelector("em")?.textContent).toBe("Read this");
  });

  it("leaves malformed, unrelated, credentialed and unsafe proxy targets alone", () => {
    const links = [
      `https://wechat2rss.bestblogs.dev.evil.test/link-proxy?u=${encodeURIComponent(original)}`,
      `http://wechat2rss.bestblogs.dev/link-proxy?u=${encodeURIComponent(original)}`,
      `https://wechat2rss.bestblogs.dev/img-proxy?u=${encodeURIComponent(original)}`,
      "https://wechat2rss.bestblogs.dev/link-proxy?u=javascript%3Aalert(1)",
      "https://wechat2rss.bestblogs.dev/link-proxy?u=https%3A%2F%2Fmp.weixin.qq.com.evil.test%2Fs%2Fabc",
      "https://wechat2rss.bestblogs.dev/link-proxy?u=https%3A%2F%2Fu%3Ap%40mp.weixin.qq.com%2Fs%2Fabc",
      "https://wechat2rss.bestblogs.dev/link-proxy?u=http%3A%2F%2Fmp.weixin.qq.com%2Fs%2Fabc",
      "https://wechat2rss.bestblogs.dev/link-proxy?u=https%3A%2F%2Fmp.weixin.qq.com%2Fother",
      "https://wechat2rss.bestblogs.dev/link-proxy?u=%E0%A4%A",
      "https://wechat2rss.bestblogs.dev/link-proxy",
    ];
    const source = links.map(href => `<a href="${href}">跳转到微信打开</a>`).join("");
    const result = rendered(source, kind);
    expect([...result.querySelectorAll("a")].map(a => a.getAttribute("href"))).toEqual(links);
    expect([...result.querySelectorAll("a")].every(a => a.textContent === "跳转到微信打开")).toBe(true);
  });
});

it("saves ordinary article HTML with the same HTTPS original link while retaining cached content", async () => {
  const app = App.createMock();
  const settings: ArticleSavingSettings = {
    addSavedTag: false, defaultFolder: "", defaultTemplate: "", includeFrontmatter: false,
    frontmatterTemplate: "", saveFullContent: false, fetchTimeout: 30000, savedTemplates: [],
  };
  const item: FeedItem = {
    title: "Wechat article", link: "https://example.com/article", description: html,
    content: html, pubDate: "", guid: "wechat-regression", feedTitle: "Feed", feedUrl: "https://example.com/rss", coverImage: "",
  };
  const file = await new ArticleSaver(app, settings).saveArticle(item);
  expect(file).toBeInstanceOf(TFile);
  if (!(file instanceof TFile)) throw new Error("Expected the saved article");
  const saved = await app.vault.read(file);
  const doc = new DOMParser().parseFromString(saved, "text/html");
  expect(doc.querySelector("a")?.getAttribute("href")).toBe(original);
  expect(doc.querySelector("a")?.textContent).toBe("查看公众号原文");
  expect(item.content).toBe(html);
  vi.spyOn(fullArticleFetch, "fetchFullArticleContentWithOutcome").mockResolvedValue({ content: html, failureType: "none" });
  const markdownFile = await new ArticleSaver(app, settings).saveArticleWithFullContent({ ...item, guid: "wechat-markdown", title: "Wechat markdown" });
  if (!(markdownFile instanceof TFile)) throw new Error("Expected the saved Markdown");
  const markdown = await app.vault.read(markdownFile);
  expect(markdown).toContain(`[查看公众号原文](${original})`);
  expect(markdown).not.toContain("link-proxy");
});
