import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { PreviewImageCache } from "../../../src/services/preview-image-cache";
import { DEFAULT_SETTINGS } from "../../../src/types/types";

const cache = vi.hoisted(() => ({ initialize: vi.fn(async () => undefined), resolveCachedUrl: vi.fn<() => string | null>(() => null), cacheUrl: vi.fn() }));
vi.mock("../../../src/services/image-cache-service", () => ({ ImageCacheService: class {
  initialize = cache.initialize;
  resolveCachedUrl = cache.resolveCachedUrl;
  cacheUrl = cache.cacheUrl;
} }));

afterEach(() => { document.body.empty(); vi.unstubAllGlobals(); vi.clearAllMocks(); cache.resolveCachedUrl.mockReturnValue(null); });

describe("article image visibility", () => {
  it("uses disk images immediately and caches remote images only near the viewport", async () => {
    let callback: IntersectionObserverCallback = () => undefined;
    const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(cb: IntersectionObserverCallback) { callback = cb; }
      observe = observe; unobserve = unobserve; disconnect = disconnect;
    });
    const app = App.createMock();
    Object.assign(app.vault.adapter, { readBinary: vi.fn(), writeBinary: vi.fn(), getResourcePath: vi.fn() });
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.display.allowImageCaching = true;
    const service = new PreviewImageCache(app, {
      manifest: { id: "dashell-rss", dir: `${app.vault.configDir}/plugins/dashell-rss` }, getSettings: () => settings,
      saveSettings: async () => undefined, isRefreshBatchRunning: () => false, getDashboardView: async () => null,
    });
    await service.initialize();
    const root = document.body.createDiv();
    const disk = root.createEl("img", { attr: { src: "https://example.com/disk.jpg" } });
    const remote = root.createEl("img", { attr: { src: "https://example.com/remote.jpg" } });
    cache.resolveCachedUrl.mockReturnValueOnce("app://local/disk.jpg");
    const dispose = service.prepareArticleImages(root);
    expect(disk.getAttribute("src")).toBe("app://local/disk.jpg");
    expect(cache.cacheUrl).not.toHaveBeenCalled();
    expect(observe).toHaveBeenCalledWith(remote);
    const rect = remote.getBoundingClientRect();
    const entry: IntersectionObserverEntry = {
      target: remote, isIntersecting: true, intersectionRatio: 1,
      boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: 0,
    };
    callback([entry], {} as IntersectionObserver);
    expect(cache.cacheUrl).toHaveBeenCalledWith("https://example.com/remote.jpg", false, expect.any(Function));
    expect(unobserve).toHaveBeenCalledWith(remote);
    dispose();
    expect(disconnect).toHaveBeenCalledOnce();
    callback([entry], {} as IntersectionObserver);
    expect(cache.cacheUrl).toHaveBeenCalledTimes(1);
  });
});
