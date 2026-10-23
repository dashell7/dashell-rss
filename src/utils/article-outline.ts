// Adapted from Qiaomu AI RSS src/article-outline.ts at 402abed (GPL-3.0-only).
// Copyright (c) 向阳乔木. Dashell: owning-window lifecycle and existing scroller.
export interface ArticleHeading { element: HTMLElement; text: string; depth: number }
export interface OutlineContext {
  prose: HTMLElement;
  scroller: HTMLElement;
  beforeJump?: () => void;
}

export function articleHeadings(prose: HTMLElement): ArticleHeading[] {
  const levels: number[] = [];
  const items: ArticleHeading[] = [];
  for (const element of prose.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")) {
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    if (!text || element.closest('[hidden],[aria-hidden="true"],details:not([open])')) continue;
    const level = Number(element.tagName.slice(1));
    while (levels.length && (levels[levels.length - 1] ?? 0) >= level) levels.pop();
    items.push({ element, text, depth: levels.length });
    levels.push(level);
  }
  return items;
}

/** Cache geometry until layout changes; ordinary scroll uses binary search. */
export class ArticleOutline {
  readonly items: ArticleHeading[];
  private tops: number[] = [];
  private active = -1;
  private frame?: number;
  private dirty = true;
  private disposed = false;
  private observer?: ResizeObserver;
  private readonly win: Window;
  constructor(private context: OutlineContext, private onActive: (index: number) => void) {
    const win = context.scroller.ownerDocument.defaultView;
    if (!win) throw new Error("无法取得阅读窗口。");
    this.win = win;
    this.items = articleHeadings(context.prose);
    context.scroller.addEventListener("scroll", this.onScroll, { passive: true });
    context.prose.addEventListener("load", this.onResize, true);
    win.addEventListener("resize", this.onResize);
    const Observer = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (Observer) {
      this.observer = new Observer(this.onResize);
      this.observer.observe(context.scroller);
      this.observer.observe(context.prose);
    }
    this.schedule();
  }
  private onScroll = () => this.schedule();
  private onResize = () => { this.dirty = true; this.schedule(); };
  private schedule(): void {
    if (this.disposed || this.frame !== undefined) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.disposed) this.update();
    });
  }
  private measure(): void {
    const { scroller } = this.context;
    const origin = scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop;
    this.tops = this.items.map(item => item.element.getBoundingClientRect().top - origin);
    this.dirty = false;
  }
  private update(): void {
    if (this.dirty) this.measure();
    const { scroller } = this.context;
    const position = scroller.scrollTop + 17;
    let low = 0, high = this.tops.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if ((this.tops[mid] ?? Infinity) <= position) low = mid + 1; else high = mid;
    }
    let next = this.items.length ? Math.max(0, low - 1) : -1;
    if (scroller.scrollHeight > scroller.clientHeight + 1 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) next = this.items.length - 1;
    if (next !== this.active) { this.active = next; this.onActive(next); }
  }
  jump(index: number): void {
    const item = this.items[index];
    if (this.disposed || !item?.element.isConnected || !this.context.prose.contains(item.element)) return;
    this.context.beforeJump?.();
    this.measure();
    const scroller = this.context.scroller;
    const top = Math.max(0, Math.min((this.tops[index] ?? 0) - 16, scroller.scrollHeight - scroller.clientHeight));
    scroller.scrollTo({ top, behavior: "instant" });
    this.update();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.context.scroller.removeEventListener("scroll", this.onScroll);
    this.context.prose.removeEventListener("load", this.onResize, true);
    this.win.removeEventListener("resize", this.onResize);
  }
}
