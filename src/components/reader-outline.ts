// Outline navigation adapted from Qiaomu AI RSS 0.31.0 (402abed, GPL-3.0-only).
// Copyright (c) 向阳乔木. Dashell: per-preview panel, no global view or data store.
import { Platform, setIcon } from "obsidian";
import { ArticleOutline, articleHeadings } from "../utils/article-outline";
import { setCssProps } from "../utils/platform-utils";

class ReaderOutlinePanel {
  private details: HTMLDetailsElement;
  private summary: HTMLElement;
  private list: HTMLElement;
  private rows: HTMLButtonElement[] = [];
  private tracker?: ArticleOutline;
  private prose?: HTMLElement;
  private observer?: MutationObserver;
  private frame?: number;
  private disposed = false;
  private win: Window;
  private doc: Document;
  private clearMigration: () => void;

  constructor(private scroller: HTMLElement, actions: HTMLElement) {
    const doc = scroller.ownerDocument;
    this.doc = doc;
    this.win = doc.defaultView!;
    this.details = actions.createEl("details", { cls: "rss-article-outline" });
    actions.prepend(this.details);
    this.summary = this.details.createEl("summary", { cls: "rss-dashell-reader-icon" });
    setIcon(this.summary, "list-tree");
    this.summary.createSpan({ cls: "rss-dashell-visually-hidden", text: "文章目录" });
    const panel = this.details.createEl("nav", { cls: "rss-outline-panel", attr: { "aria-label": "文章目录" } });
    panel.createDiv({ cls: "rss-outline-title", text: "文章目录" });
    this.list = panel.createDiv({ cls: "rss-outline-body" });
    this.details.addEventListener("toggle", this.toggle);
    this.details.addEventListener("keydown", this.keydown);
    doc.addEventListener("pointerdown", this.outside);
    this.clearMigration = scroller.onWindowMigrated(() => this.migrate());
  }
  private migrate(): void {
    if (this.disposed || this.doc === this.scroller.ownerDocument) return;
    this.release();
    this.doc.removeEventListener("pointerdown", this.outside);
    this.doc = this.scroller.ownerDocument;
    this.win = this.doc.defaultView!;
    this.doc.addEventListener("pointerdown", this.outside);
    this.toggle();
  }
  private outside = (event: Event) => {
    if (!event.composedPath().includes(this.details)) this.close();
  };
  private keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.isComposing || !this.details.open) return;
    event.preventDefault(); event.stopPropagation(); this.close();
    this.summary.focus({ preventScroll: true });
  };
  private toggle = () => {
    if (this.disposed) return;
    if (!this.details.open) { this.release(); return; }
    this.refresh();
    if (this.observer) return;
    const Observer = (this.win as Window & { MutationObserver: typeof MutationObserver }).MutationObserver;
    this.observer = new Observer(() => this.schedule());
    this.observer.observe(this.scroller, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "open"] });
  };
  private schedule(): void {
    if (this.disposed || !this.details.open || this.frame !== undefined) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.disposed && this.details.open) this.refresh();
    });
  }
  private refresh(): void {
    const prose = this.scroller.querySelector<HTMLElement>(".rss-reader-article-content");
    const items = prose ? articleHeadings(prose) : [];
    const previous = this.tracker?.items;
    if (prose === this.prose && previous && items.length === previous.length && items.every((item, i) => {
      const before = previous[i];
      return before && item.element === before.element && item.text === before.text && item.depth === before.depth;
    })) return;
    this.tracker?.dispose(); this.tracker = undefined;
    this.prose = prose ?? undefined; this.rows = []; this.list.empty();
    if (!prose || !items.length) {
      this.list.createDiv({ cls: "rss-outline-empty", text: "本文没有小标题" });
      return;
    }
    const list = this.list.createEl("ul", { cls: "rss-outline-list" });
    this.tracker = new ArticleOutline({ prose, scroller: this.scroller, beforeJump: () => {
      const EventType = (this.win as Window & { Event: typeof Event }).Event;
      this.scroller.dispatchEvent(new EventType("rss-outline-jump"));
    } }, index => this.select(index));
    for (const [index, heading] of this.tracker.items.entries()) {
      const row = list.createEl("li").createEl("button", { cls: "rss-outline-row", text: heading.text, attr: { type: "button" } });
      setCssProps(row, { "--rss-outline-depth": String(heading.depth) });
      row.addEventListener("click", () => { this.tracker?.jump(index); if (Platform.isMobileApp) this.close(); });
      this.rows.push(row);
    }
  }
  private select(index: number): void {
    for (const [i, row] of this.rows.entries()) {
      row.toggleClass("is-active", i === index);
      if (i === index) row.setAttribute("aria-current", "location"); else row.removeAttribute("aria-current");
    }
    const row = this.rows[index];
    if (!row || this.list.contains(this.scroller.ownerDocument.activeElement)) return;
    const bounds = this.list.getBoundingClientRect(), rect = row.getBoundingClientRect();
    if (rect.top < bounds.top) this.list.scrollTop -= bounds.top - rect.top;
    else if (rect.bottom > bounds.bottom) this.list.scrollTop += rect.bottom - bounds.bottom;
  }
  private close(): void { this.details.open = false; this.release(); }
  private release(): void {
    this.tracker?.dispose(); this.tracker = undefined;
    this.observer?.disconnect(); this.observer = undefined;
    if (this.frame !== undefined) this.win.cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.release();
    this.details.removeEventListener("toggle", this.toggle);
    this.details.removeEventListener("keydown", this.keydown);
    this.doc.removeEventListener("pointerdown", this.outside);
    this.clearMigration();
    this.details.remove();
  }
}

export function mountReaderOutline(scroller: HTMLElement): () => void {
  const actions = scroller.closest(".rss-dashell-reader")?.querySelector<HTMLElement>(".rss-reader-actions");
  if (!actions || !scroller.ownerDocument.defaultView) return () => undefined;
  const panel = new ReaderOutlinePanel(scroller, actions);
  return () => panel.dispose();
}
