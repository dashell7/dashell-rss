import { afterEach, describe, expect, it, vi } from "vitest";
import * as transport from "../../../src/utils/platform-utils";
import { fetchPageCover } from "../../../src/services/page-cover-fetch";

afterEach(() => vi.restoreAllMocks());
function page(html: string) {
  return vi.spyOn(transport, "robustFetchDetailed").mockResolvedValue({ text: html, status: 200, headers: {} });
}
describe("page covers on the existing transport", () => {
  it("resolves a relative declared image with one low-priority request", async () => {
    const request = page('<head><meta property="og:image" content="/hero.png"></head><body><img src="avatar.png"></body>');
    expect(await fetchPageCover("https://example.com/a")).toBe("https://example.com/hero.png");
    expect(request).toHaveBeenCalledExactlyOnceWith("https://example.com/a", { priority: 1 });
  });
  it("falls back from invalid OG to Twitter, without scanning body images", async () => {
    page('<head><meta property="og:image" content="javascript:alert(1)"><meta name="twitter:image" content="https://img.example.com/cover"></head>');
    expect(await fetchPageCover("https://example.com/a")).toBe("https://img.example.com/cover");
    page('<head></head><body><meta property="og:image" content="https://evil.example/img"><img src="avatar.png"></body>');
    expect(await fetchPageCover("https://example.com/a")).toBe("");
  });
  it("reads an article's JSON-LD image while ignoring malformed scripts", async () => {
    page('<head><script type="application/ld+json">bad</script><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","image":{"@type":"ImageObject","contentUrl":"/news.jpg"}}]}</script></head>');
    expect(await fetchPageCover("https://example.com/a")).toBe("https://example.com/news.jpg");
  });
  it("refuses credential URLs without requesting and ignores script image schemes", async () => {
    const request = page('<head><script type="application/ld+json">{"@type":"Article","image":"data:image/png;base64,x"}</script></head>');
    expect(await fetchPageCover("https://user:pass@example.com/a")).toBe("");
    expect(request).not.toHaveBeenCalled();
    expect(await fetchPageCover("https://example.com/a")).toBe("");
  });
});
