/** Bilibili preview adapted from Qiaomu AI RSS 0.27.4 (GPL-3.0-only). */
export function bilibiliEmbedUrl(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || !["bilibili.com", "www.bilibili.com", "m.bilibili.com"].includes(url.hostname) || url.username || url.password) return null;
    const match = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})\/?$/);
    if (!match) return null;
    const embed = new URL("https://player.bilibili.com/player.html");
    embed.searchParams.set("bvid", match[1] ?? "");
    const page = url.searchParams.get("p");
    if (page && /^[1-9]\d{0,5}$/.test(page)) embed.searchParams.set("p", page);
    embed.searchParams.set("autoplay", "0");
    embed.searchParams.set("high_quality", "1");
    embed.searchParams.set("danmaku", "0");
    return embed.href;
  } catch { return null; }
}
