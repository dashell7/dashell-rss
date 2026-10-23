import { afterEach, describe, expect, it, vi } from "vitest";
import { mountReaderOutline } from "../../../src/components/reader-outline";
import { articleFragment } from "../../../src/dashell/content";
import { workbenchToolbar } from "../../../src/dashell/workbench-toolbar";
import type { FeedItem } from "../../../src/types/types";
import { versionControls } from "../../../src/dashell/learning-panel";
import { readerStart } from "../../../src/dashell/reader-chrome";
import { restoreReadingScroll } from "../../../src/dashell/workbench-scroll";

afterEach(() => { document.body.empty(); vi.restoreAllMocks(); });

function fixture() {
  const root = document.body.createDiv({ cls: "rss-dashell-reader" });
  const toolbar = root.createDiv({ cls: "rss-reader-header" });
  toolbar.createDiv({ cls: "rss-reader-actions" });
  const body = root.createDiv();
  const prose = body.createDiv({ cls: "rss-reader-article-content" });
  prose.createEl("h2", { text: "First" });
  prose.createEl("h3", { text: "Nested" });
  body.scrollTo = vi.fn();
  const cleanup = mountReaderOutline(body);
  const details = root.querySelector<HTMLDetailsElement>(".rss-article-outline")!;
  const open = () => { details.open = true; details.dispatchEvent(new Event("toggle")); };
  return { root, body, prose, details, cleanup, open };
}

describe("reader outline panel", () => {
  it("keeps prose identity, refreshes reading versions, handles empty text and releases its resources", async () => {
    const f = fixture(); f.open();
    expect(f.details.querySelectorAll(".rss-outline-row")).toHaveLength(2);
    const original = f.prose.firstElementChild;
    f.details.querySelector<HTMLButtonElement>(".rss-outline-row")!.click();
    expect(f.prose.firstElementChild).toBe(original);
    expect(f.details.open).toBe(true);
    f.prose.replaceChildren(articleFragment("## 改写\n\n### 小节", "rewrite", document, false));
    await vi.waitFor(() => expect(f.details.textContent).toContain("改写"));
    expect(f.details.textContent).not.toContain("First");
    f.prose.setText("Plain prose");
    await vi.waitFor(() => expect(f.details.textContent).toContain("本文没有小标题"));
    f.cleanup(); f.cleanup();
    expect(f.root.querySelector(".rss-article-outline")).toBeNull();
  });
  it("closes with Escape or an outside click, returns keyboard focus and does not change reading position", () => {
    const f = fixture(); f.body.scrollTop = 123; f.open();
    const row = f.details.querySelector<HTMLButtonElement>(".rss-outline-row")!; row.focus();
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(f.details.open).toBe(false);
    expect(document.activeElement).toBe(f.details.querySelector("summary"));
    expect(f.body.scrollTop).toBe(123);
    f.open(); f.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(f.details.open).toBe(false);
    f.cleanup();
  });
  it("preserves the mounted outline across workbench toolbar refreshes and exposes reading settings directly", () => {
    const f = fixture(); f.open(); const format = vi.fn();
    const item = { title: "Article", guid: "one", link: "https://example.com" } as FeedItem;
    workbenchToolbar({ reader: f.root, item, focused: false, fold: vi.fn(), navigate: vi.fn(), update: vi.fn(), save: vi.fn(), more: vi.fn(), format });
    expect(f.root.querySelector(".rss-article-outline")).toBe(f.details);
    f.root.querySelector<HTMLButtonElement>(".rss-workbench-format")!.click();
    expect(format).toHaveBeenCalledOnce(); f.cleanup();
  });
  it("follows translated heading levels and restores the exact original nodes on version change", async () => {
    const f = fixture();
    readerStart(f.root.querySelector(".rss-reader-header")!, vi.fn(), vi.fn());
    const original = f.prose.firstElementChild;
    const item = { link: "https://example.com", dashell: { translation: "<h2>译文标题</h2><h4>译文小节</h4>", rewrite: "## 改写标题" } } as FeedItem;
    const clearVersions = versionControls(document.body.createDiv(), f.body, item);
    f.open();
    const select = f.root.querySelector("select")!;
    select.value = "translation"; select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(f.details.querySelectorAll(".rss-outline-row")[0]?.textContent).toBe("译文标题"));
    expect(f.details.querySelectorAll(".rss-outline-row")[1]?.getAttribute("style")).toContain("1");
    select.value = "rewrite"; select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(f.details.textContent).toContain("改写标题"));
    select.value = "original"; select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(f.details.textContent).toContain("First"));
    expect(f.prose.firstElementChild).toBe(original);
    clearVersions(); f.cleanup();
  });
  it("stops pending scroll restoration when the user selects a heading", async () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal("ResizeObserver", class { constructor(fn: () => void) { resize = fn; } observe() {} disconnect() { resize = undefined; } });
    const f = fixture();
    Object.defineProperties(f.body, { clientHeight: { value: 300 }, scrollHeight: { value: 400 } });
    const stop = restoreReadingScroll(f.body, 1000);
    expect(resize).toBeDefined();
    f.open(); f.details.querySelector<HTMLButtonElement>(".rss-outline-row")!.click();
    f.body.scrollTop = 20; resize?.();
    expect(f.body.scrollTop).toBe(20);
    stop(); f.cleanup(); vi.unstubAllGlobals();
  });
  it("moves document listeners to the new owning window and removes them on close", () => {
    let migrated: ((win: Window) => unknown) | undefined;
    const unhook = vi.fn();
    vi.spyOn(HTMLElement.prototype, "onWindowMigrated").mockImplementation(listener => { migrated = listener; return unhook; });
    const f = fixture(); f.open();
    const frame = document.body.createEl("iframe"), win = frame.contentWindow!;
    // Obsidian installs its DOM helpers in every popout; jsdom iframes do not.
    const scope = win as Window & { Node: typeof Node; Element: typeof Element; HTMLElement: typeof HTMLElement };
    for (const [source, target] of [[Node.prototype, scope.Node.prototype], [Element.prototype, scope.Element.prototype], [HTMLElement.prototype, scope.HTMLElement.prototype]]) {
      for (const name of ["createEl", "createDiv", "empty", "toggleClass"]) {
        const descriptor = Object.getOwnPropertyDescriptor(source, name);
        if (descriptor) Object.defineProperty(target, name, descriptor);
      }
    }
    win.document.body.append(f.root); migrated?.(win);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(f.details.open).toBe(true);
    const EventType = (win as Window & { Event: typeof Event }).Event;
    win.document.body.dispatchEvent(new EventType("pointerdown", { bubbles: true }));
    expect(f.details.open).toBe(false);
    f.cleanup(); expect(unhook).toHaveBeenCalledOnce(); frame.remove();
  });
});
