import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbenchWindow } from "../../../src/dashell/workbench-window";
import { entryId } from "../../../src/dashell/workbench-list";
import type { FeedItem } from "../../../src/types/types";

const article = (i: number): FeedItem => ({ guid: String(i), feedUrl: "https://example.com/rss", feedTitle: "Feed", title: `Article ${i}`, description: "Summary", pubDate: "2026-10-16", link: "https://example.com", coverImage: "" });
function surface() {
  const host = document.body.createDiv({ attr: { tabindex: "0" } });
  Object.defineProperty(host, "clientHeight", { value: 400 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height: 130 }) as DOMRect);
  const open = vi.fn();
  const view = new WorkbenchWindow(host, open);
  const items = Array.from({ length: 10000 }, (_, i) => article(i));
  view.update(items, "");
  return { host, open, view, items };
}
afterEach(() => { document.body.empty(); vi.restoreAllMocks(); });

describe("bounded reading list", () => {
  it("reaches the end of a large list without accumulating rows", () => {
    const { host, view, items, open } = surface();
    expect(host.querySelectorAll("button").length).toBeLessThan(25);
    view.scrollTo(entryId(items[9999]));
    const last = Array.from(host.querySelectorAll("button")).find(row => row.dataset.entryId === entryId(items[9999]));
    expect(last).toBeDefined();
    last?.click();
    expect(open).toHaveBeenCalledWith(items[9999]);
    expect(host.querySelectorAll("button").length).toBeLessThan(25);
    view.dispose();
  });
  it("keeps the reading anchor when new articles arrive and preserves row focus on refresh", () => {
    const { host, view, items } = surface();
    host.scrollTop = 650007;
    view.render();
    const before = view.anchor();
    const row = host.querySelector<HTMLButtonElement>("button")!;
    row.focus();
    view.update(items, entryId(items[5000]));
    expect(document.activeElement).toBe(row);
    view.update([article(-1), ...items], "");
    expect(view.anchor()).toEqual(before);
    expect(host.scrollTop).toBe(650137);
    view.dispose();
  });
  it("refreshes changed text without losing ordering or opening stale records", () => {
    const { host, view, items, open } = surface();
    const fresh = { ...items[0], title: "Updated" };
    view.update([fresh, ...items.slice(1)], "");
    const first = host.querySelector<HTMLButtonElement>("button")!;
    expect(first.textContent).toContain("Updated");
    first.click();
    expect(open).toHaveBeenCalledWith(fresh);
    view.dispose();
  });
  it("navigates beyond mounted rows with the keyboard and stops after disposal", () => {
    const { host, view, items } = surface();
    host.querySelector<HTMLButtonElement>("button")!.focus();
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect((document.activeElement as HTMLElement).dataset.entryId).toBe(entryId(items[9999]));
    const before = host.innerHTML;
    view.dispose();
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(host.innerHTML).toBe(before);
  });
});
