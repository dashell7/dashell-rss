// List and channel interactions adapted from Qiaomu AI RSS ac2c792 (GPL-3.0-only).
import { FuzzySuggestModal, type App } from "obsidian";
import type { Feed, FeedItem } from "../types/types";
import { articleFragment } from "./content";
import { safeUrl } from "./safety";
import { listWidth } from "./workbench-state";

export const entryId = (item: FeedItem): string =>
  JSON.stringify([item.feedUrl, item.guid]);
export interface ChannelChoice {
  id: string;
  label: string;
}
export function channelChoices(feeds: Feed[]): ChannelChoice[] {
  const folders = [
    ...new Set(feeds.map((feed) => feed.folder).filter(Boolean)),
  ];
  return [
    { id: "@all", label: "全部订阅" },
    ...folders.map((folder) => ({ id: `@folder:${folder}`, label: folder })),
    ...feeds.map((feed) => ({ id: feed.url, label: feed.title })),
  ];
}
export class ChannelPicker extends FuzzySuggestModal<ChannelChoice> {
  constructor(
    app: App,
    private choices: ChannelChoice[],
    private choose: (id: string) => void,
  ) {
    super(app);
    this.setPlaceholder("搜索频道或分组");
  }
  getItems(): ChannelChoice[] {
    return this.choices;
  }
  getItemText(item: ChannelChoice): string {
    return item.label;
  }
  onChooseItem(item: ChannelChoice): void {
    this.choose(item.id);
  }
}
export function renderEntry(
  parent: HTMLElement,
  item: FeedItem,
  selected: boolean,
  open: () => void,
): void {
  const button = parent.createEl("button", {
    cls: "rss-workbench-entry",
    attr: { type: "button", "aria-pressed": String(selected) },
  });
  button.toggleClass("is-selected", selected);
  button.toggleClass("is-read", item.read === true);
  button.dataset.entryId = entryId(item);
  const meta = button.createDiv({ cls: "rss-workbench-entry-meta" });
  meta.createSpan({ cls: "rss-workbench-source", text: item.feedTitle });
  const date = new Date(item.pubDate);
  meta.createSpan({
    cls: "rss-workbench-date",
    text: Number.isNaN(date.getTime())
      ? ""
      : `${date.getMonth() + 1}/${date.getDate()}`,
  });
  button.createEl("h3", { text: item.title });
  const summary =
    articleFragment(
      item.summary || item.description,
      "original",
      parent.ownerDocument,
      false,
    ).textContent ?? "";
  button.createEl("p", { cls: "rss-workbench-summary", text: summary });
  const image = safeUrl(item.coverImage || item.image || "");
  if (image) {
    const thumbnail = button.createDiv({ cls: "rss-workbench-thumbnail" });
    const img = thumbnail.createEl("img", {
      attr: {
        src: image,
        alt: "",
        loading: "lazy",
        referrerpolicy: "no-referrer",
      },
    });
    img.addEventListener(
      "error",
      () => {
        thumbnail.remove();
      },
      { once: true },
    );
  }
  button.addEventListener("click", open);
}

export function bindListResize(options: {
  handle: HTMLElement;
  root: HTMLElement;
  current: () => number;
  change: (value: number) => void;
  save: () => void;
}): () => void {
  const { handle, root, current, change, save } = options;
  const doc = root.ownerDocument;
  let pointer: number | null = null;
  const move = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    change(listWidth(event.clientX - root.getBoundingClientRect().left));
  };
  const end = (event?: PointerEvent) => {
    if (event && pointer !== event.pointerId) return;
    if (pointer === null) return;
    pointer = null;
    root.removeClass("is-resizing");
    doc.removeEventListener("pointermove", move);
    doc.removeEventListener("pointerup", end);
    doc.removeEventListener("pointercancel", end);
    save();
  };
  const start = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointer = event.pointerId;
    root.addClass("is-resizing");
    doc.addEventListener("pointermove", move);
    doc.addEventListener("pointerup", end);
    doc.addEventListener("pointercancel", end);
  };
  const key = (event: KeyboardEvent) => {
    const widths: Record<string, number> = {
      ArrowLeft: current() - 20,
      ArrowRight: current() + 20,
      Home: 220,
      End: 520,
    };
    const width = widths[event.key];
    if (width === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    change(listWidth(width));
    save();
  };
  handle.addEventListener("pointerdown", start);
  handle.addEventListener("keydown", key);
  return () => {
    end();
    handle.removeEventListener("pointerdown", start);
    handle.removeEventListener("keydown", key);
  };
}
