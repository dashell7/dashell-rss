import type { FeedItem } from "../types/types";
import { setCssProps } from "../utils/platform-utils";
import { ListWindow } from "./list-window";
import { entryId, renderEntry } from "./workbench-list";

export interface ListAnchor { id: string; offset: number }
interface Row { node: HTMLButtonElement; item: FeedItem; signature: string }

/** Owns only the visible list rows. Article rendering remains in the workbench. */
export class WorkbenchWindow {
  private model = new ListWindow();
  private rows = new Map<string, Row>();
  private items: FeedItem[] = [];
  private selected = "";
  private before: HTMLElement;
  private after: HTMLElement;
  private observer?: ResizeObserver;
  private frame: number | null = null;
  private width = 0;
  private closed = false;

  constructor(private host: HTMLElement, private open: (item: FeedItem) => void) {
    this.before = host.createDiv({ cls: "rss-workbench-spacer", attr: { "aria-hidden": "true" } });
    this.after = host.createDiv({ cls: "rss-workbench-spacer", attr: { "aria-hidden": "true" } });
    host.addEventListener("scroll", this.schedule);
    host.addEventListener("keydown", this.keydown);
    const Observer = host.ownerDocument.defaultView?.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(() => {
        if (!host.clientHeight) return;
        const anchor = this.anchor();
        const resized = host.clientWidth !== this.width;
        if (resized) {
          this.width = host.clientWidth;
          this.model.clearMeasurements();
        }
        if (this.measure() || resized) this.restore(anchor);
        this.schedule();
      });
      this.observer.observe(host);
    }
  }
  anchor(): ListAnchor | undefined {
    const index = this.model.indexAt(this.host.scrollTop);
    const id = this.model.idAt(index);
    return id ? { id, offset: this.host.scrollTop - this.model.offset(index) } : undefined;
  }
  restore(anchor?: ListAnchor, fallback = this.host.scrollTop): void {
    const index = anchor ? this.model.position(anchor.id) : undefined;
    this.host.scrollTop = index === undefined ? fallback : this.model.offset(index) + (anchor?.offset ?? 0);
  }
  update(items: FeedItem[], selected: string): void {
    const anchor = this.anchor();
    this.items = items;
    this.selected = selected;
    this.model.setItems(items.map(entryId));
    // Grow the scrollable area before restoring a far position.
    setCssProps(this.after, { height: `${this.model.total}px` });
    this.restore(anchor);
    this.render();
  }
  scrollTo(id: string): void {
    const index = this.model.position(id);
    if (index === undefined) return;
    const top = this.model.offset(index), bottom = this.model.offset(index + 1);
    if (top < this.host.scrollTop) this.host.scrollTop = top;
    else if (bottom > this.host.scrollTop + this.host.clientHeight) this.host.scrollTop = bottom - this.host.clientHeight;
    this.render();
  }
  render(): void {
    if (this.closed) return;
    const anchor = this.anchor();
    const range = this.model.range(this.host.scrollTop, this.host.clientHeight || 400);
    const visible = this.items.slice(range.start, range.end);
    const keys = new Set(visible.map(entryId));
    for (const [id, row] of this.rows) if (!keys.has(id)) this.remove(id, row);
    let previous: ChildNode = this.before;
    for (const item of visible) {
      const node = this.renderRow(item);
      if (node !== previous.nextSibling) this.host.insertBefore(node, previous.nextSibling);
      previous = node;
    }
    this.measure();
    setCssProps(this.before, { height: `${this.model.offset(range.start)}px` });
    setCssProps(this.after, { height: `${this.model.total - this.model.offset(range.end)}px` });
    this.restore(anchor);
  }
  private renderRow(item: FeedItem): HTMLButtonElement {
    const id = entryId(item);
    const signature = JSON.stringify([item.title, item.description, item.summary, item.coverImage, item.image, item.feedTitle, item.pubDate]);
    let row = this.rows.get(id);
    if (!row || row.signature !== signature) {
      const focused = row?.node === this.host.ownerDocument.activeElement;
      if (row) this.remove(id, row);
      const node = renderEntry(this.host, item, false, () => {
        const current = this.rows.get(id)?.item;
        if (current) this.open(current);
      });
      row = { node, item, signature };
      this.rows.set(id, row);
      this.observer?.observe(node);
      if (focused) node.focus({ preventScroll: true });
    }
    row.item = item;
    row.node.toggleClass("is-selected", this.selected === id);
    row.node.toggleClass("is-read", item.read === true);
    row.node.setAttribute("aria-pressed", String(this.selected === id));
    return row.node;
  }
  private measure(): boolean {
    let changed = false;
    for (const [id, row] of this.rows) changed = this.model.measure(id, row.node.getBoundingClientRect().height) || changed;
    return changed;
  }
  private remove(id: string, row: Row): void {
    if (row.node === this.host.ownerDocument.activeElement) this.host.focus({ preventScroll: true });
    this.observer?.unobserve(row.node);
    row.node.remove();
    this.rows.delete(id);
  }
  private schedule = (): void => {
    if (this.closed || this.frame !== null) return;
    this.frame = this.host.ownerDocument.defaultView?.requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    }) ?? null;
  };
  private keydown = (event: KeyboardEvent): void => {
    if (event.isComposing || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const focused = this.host.ownerDocument.activeElement as HTMLElement | null;
    const index = this.model.position(focused?.dataset.entryId ?? "") ?? 0;
    const next = event.key === "Home" ? 0 : event.key === "End" ? this.items.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1);
    const item = this.items[Math.max(0, Math.min(this.items.length - 1, next))];
    if (!item) return;
    event.preventDefault();
    this.scrollTo(entryId(item));
    this.rows.get(entryId(item))?.node.focus({ preventScroll: true });
  };
  dispose(): void {
    this.closed = true;
    if (this.frame !== null) this.host.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.host.removeEventListener("scroll", this.schedule);
    this.host.removeEventListener("keydown", this.keydown);
    this.rows.clear();
  }
}
