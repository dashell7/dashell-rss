// Adapted from Qiaomu AI RSS d42212e (GPL-3.0-only), copyright 向阳乔木.
// Only the known feed proxy is unwrapped; cached source HTML is never changed.
function wechatProxyArticle(link: string): string | null {
  try {
    const proxy = new URL(link);
    if (
      proxy.origin !== "https://wechat2rss.bestblogs.dev" ||
      proxy.username || proxy.password ||
      !/^\/link-proxy\/?$/.test(proxy.pathname)
    ) return null;
    const target = new URL(proxy.searchParams.get("u") || "");
    if (
      target.origin !== "https://mp.weixin.qq.com" ||
      target.username || target.password ||
      !/^\/s(?:\/[A-Za-z0-9_-]+)?\/?$/.test(target.pathname)
    ) return null;
    return target.href;
  } catch {
    return null;
  }
}

/** Normalize only anchors in the caller's sanitized display/export copy. */
export function normalizeWechatArticleLinks(root: ParentNode): void {
  for (const link of root.querySelectorAll("a[href]")) {
    const original = wechatProxyArticle(link.getAttribute("href") || "");
    if (!original) continue;
    link.setAttribute("href", original);
    if (/^跳转(?:到)?微信打开$/.test(link.textContent?.trim() || "")) {
      link.textContent = "查看公众号原文";
    }
  }
}
