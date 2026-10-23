import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleOutline, articleHeadings } from "../../../src/utils/article-outline";

afterEach(() => { document.body.empty(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("article heading navigation", () => {
  it("retains duplicate headings and normalizes skipped levels without changing prose", () => {
    const prose = document.body.createDiv();
    const parsed = new DOMParser().parseFromString('<h2>Part <em>one</em></h2><h4>Detail</h4><h3>Detail</h3><p><b>Body</b></p><h2>Part one</h2><h6> </h6><div hidden><h2>Hidden</h2></div><details><h3>Collapsed</h3></details>', "text/html");
    prose.append(...parsed.body.childNodes);
    const html = prose.innerHTML;
    const items = articleHeadings(prose);
    expect(items.map(item => [item.text, item.depth])).toEqual([["Part one", 0], ["Detail", 1], ["Detail", 1], ["Part one", 0]]);
    expect(items[0].element).not.toBe(items[3].element);
    expect(prose.innerHTML).toBe(html);
  });
});

function fixture() {
  let frame: FrameRequestCallback | undefined;
  const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(fn => { frame = fn; return 1; });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => { frame = undefined; });
  let resized: (() => void) | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class { constructor(fn: () => void) { resized = fn; } observe() {} disconnect = disconnect; });
  const scroller = document.body.createDiv();
  const prose = scroller.createDiv();
  for (const text of ["Same", "Same", "End"]) prose.createEl("h2", { text });
  Object.defineProperties(scroller, { scrollHeight: { value: 1400 }, clientHeight: { value: 400 } });
  scroller.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  const positions = [200, 600, 1200];
  const measurements = [...prose.children].map((heading, i) => vi.spyOn(heading, "getBoundingClientRect").mockImplementation(() => ({ top: 100 + positions[i] - scroller.scrollTop }) as DOMRect));
  scroller.scrollTo = vi.fn(options => { scroller.scrollTop = (options as ScrollToOptions).top!; });
  const selected = vi.fn(), beforeJump = vi.fn();
  const outline = new ArticleOutline({ prose, scroller, beforeJump }, selected);
  const flush = () => { const fn = frame; frame = undefined; fn?.(0); };
  return { outline, scroller, prose, selected, beforeJump, flush, positions, measurements, disconnect, cancel, raf, resize: () => resized?.() };
}

describe("outline tracking", () => {
  it("jumps to the chosen duplicate, follows scrolling and caches measurements", () => {
    const f = fixture(); f.flush(); f.outline.jump(1);
    expect(f.beforeJump).toHaveBeenCalledOnce();
    expect(f.scroller.scrollTop).toBe(584);
    expect(f.selected).toHaveBeenLastCalledWith(1);
    const reads = f.measurements[0].mock.calls.length;
    f.scroller.scrollTop = 200; f.scroller.dispatchEvent(new Event("scroll")); f.flush();
    expect(f.selected).toHaveBeenLastCalledWith(0);
    expect(f.measurements[0]).toHaveBeenCalledTimes(reads);
    f.outline.dispose();
  });
  it("remeasures layout changes, selects the last section at bottom and disposes queued callbacks", () => {
    const f = fixture(); f.flush(); f.positions[1] = 800; f.resize(); f.flush(); f.outline.jump(1);
    expect(f.scroller.scrollTop).toBe(784);
    f.scroller.scrollTop = 1000; f.scroller.dispatchEvent(new Event("scroll")); f.flush();
    expect(f.selected).toHaveBeenLastCalledWith(2);
    f.scroller.dispatchEvent(new Event("scroll")); f.outline.dispose(); f.outline.dispose();
    expect(f.cancel).toHaveBeenCalledOnce();
    expect(f.disconnect).toHaveBeenCalledOnce();
    const calls = f.raf.mock.calls.length;
    f.scroller.dispatchEvent(new Event("scroll")); f.resize(); f.flush();
    expect(f.raf).toHaveBeenCalledTimes(calls);
  });
});
