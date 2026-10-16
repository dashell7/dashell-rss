import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAboutTab } from "../../../src/settings/tabs/about-settings-tab";
import { installObsidianDomPolyfills } from "../test-dom-polyfills";

beforeEach(() => {
  installObsidianDomPolyfills();
  document.body.empty();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("renderAboutTab()", () => {
  it("renders name/version and link buttons with safe attrs", () => {
    const containerEl = createDiv();
    document.body.appendChild(containerEl);
    const plugin = {
      manifest: {
        name: "RSS Dashboard",
        version: "9.9.9",
      },
    };

    renderAboutTab(containerEl, plugin as unknown as import("../../../main").default);

    expect(
      containerEl.querySelector(".rss-dashboard-about-title")?.textContent,
    ).toBe("RSS Dashboard");
    expect(
      containerEl.querySelector(".rss-dashboard-about-version")?.textContent,
    ).toBe("v9.9.9");

    const links = Array.from(
      containerEl.querySelectorAll("a.rss-dashboard-about-btn"),
    );
    expect(links.length).toBeGreaterThanOrEqual(6);

    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https?:\/\//);
      expect(link.textContent?.length).toBeGreaterThan(0);
    }

    const destinations = links.map((link) => link.getAttribute("href"));
    expect(destinations).toContain("https://github.com/dashell7/dashell-rss");
    expect(destinations).toContain("https://github.com/dashell7/dashell-rss/issues");
    expect(destinations).toContain("https://github.com/dashell7/dashell-reader");
    expect(destinations).toContain("https://github.com/dashell7/dashell-player");
    expect(destinations).not.toContain("https://github.com/dashell7/qiaomu-reader-english");
    expect(destinations).not.toContain("https://github.com/dashell7/obsidian-langplayer");

    const contacts = Array.from(
      containerEl.querySelectorAll(".rss-dashboard-about-contact"),
    );
    expect(contacts.map((row) => row.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("dashell7@gmail.com"),
        expect.stringContaining("@dashell77"),
        expect.stringContaining("@dashell7"),
        expect.stringContaining("Adashell"),
      ]),
    );
    const qrImages = Array.from(
      containerEl.querySelectorAll<HTMLImageElement>(".rss-dashboard-about-qr-image"),
    );
    expect(qrImages.map((image) => image.alt)).toEqual([
      "dashell7 赞赏码",
      "Dashell 微信公众号二维码",
    ]);
  });
});

describe("renderAboutTab() build details", () => {
  function renderWithVersion(version: string): HTMLElement {
    const containerEl = createDiv();
    document.body.appendChild(containerEl);
    renderAboutTab(containerEl, {
      manifest: { name: "RSS Dashboard", version },
    } as unknown as import("../../../main").default);
    return containerEl;
  }

  it("shows the build details under the version", () => {
    const containerEl = renderWithVersion("9.9.9");

    expect(
      containerEl.querySelector(".rss-dashboard-about-build-label")?.textContent,
    ).toBe("Version 9.9.9 · build unknown");
  });

  it("copies the build details for bug reports", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const containerEl = renderWithVersion("9.9.9");

    containerEl
      .querySelector<HTMLElement>(".rss-dashboard-about-build-copy")
      ?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("Version 9.9.9 · build unknown");
  });
});
