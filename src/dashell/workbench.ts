// Reading shell adapted from Qiaomu AI RSS src/view.ts at ac2c792 (GPL-3.0-only).
import { Notice, setIcon } from "obsidian";
import { DEFAULT_SETTINGS, type FeedItem } from "../types/types";
import type { WorkbenchOptions } from "./workbench-contract";
import { createReaderFormatPortal } from "../utils/reader-format-portal";
import { setCssProps } from "../utils/platform-utils";
import { readerIcon } from "./reader-chrome";
import { workbenchToolbar, workbenchMenu } from "./workbench-toolbar";
import { applyWorkbenchFormat } from "./workbench-format";
import {
  bindListResize,
  ChannelPicker,
  channelChoices,
  entryId,
  renderEntry,
} from "./workbench-list";
import {
  newChannel,
  workspacePreferences,
  type ChannelState,
  type ReadingFilter,
} from "./workbench-state";
import { displayError } from "./safety";
import { restoreReadingScroll } from "./workbench-scroll";

export class ReadingWorkbench {
  private prefs;
  private list: HTMLElement;
  private reader: HTMLElement;
  private channelButton: HTMLButtonElement;
  private search: HTMLInputElement;
  private searchBox: HTMLElement;
  private clearSearch: HTMLButtonElement;
  private filters: HTMLElement;
  private selected: FeedItem | null = null;
  private body: HTMLElement | null = null;
  private request = 0;
  private timer: number | null = null;
  private limit = 80;
  private closed = false;
  private cleanupArticle?: () => void;
  private clearScroll?: () => void;
  private clearResize: () => void;
  private formatPortal?: ReturnType<typeof createReaderFormatPortal>;
  private unreadSession = new Set<string>();

  constructor(private options: WorkbenchOptions) {
    this.prefs = workspacePreferences(options.settings.dashellWorkspace);
    options.settings.dashellWorkspace = this.prefs;
    if (
      !channelChoices(options.feeds()).some(
        (choice) => choice.id === this.prefs.channel,
      )
    )
      this.prefs.channel = "@all";
    const root = options.root;
    root.empty();
    root.addClass("rss-workbench", "rss-dashell-reader");
    const layout = root.createDiv({ cls: "rss-workbench-layout" });
    const sidebar = layout.createEl("aside", { cls: "rss-workbench-sidebar" });
    const toolbar = sidebar.createDiv({ cls: "rss-workbench-sidebar-toolbar" });
    if (options.back)
      readerIcon(toolbar, "arrow-left", "返回订阅首页", options.back);
    this.channelButton = toolbar.createEl("button", {
      cls: "rss-workbench-channel",
      attr: { type: "button", "aria-haspopup": "dialog" },
    });
    this.channelButton.addEventListener("click", () => this.pickChannel());
    readerIcon(toolbar, "plus", "管理订阅", options.manageFeeds);
    readerIcon(toolbar, "search", "搜索文章", () => this.toggleSearch());
    const refresh = readerIcon(toolbar, "refresh-cw", "刷新订阅", () => {
      refresh.disabled = true;
      void this.run(options.refresh).finally(() => {
        refresh.disabled = false;
        this.refresh();
      });
    });
    this.filters = sidebar.createDiv({
      cls: "rss-workbench-filters",
      attr: { role: "group", "aria-label": "文章筛选" },
    });
    this.searchBox = sidebar.createDiv({ cls: "rss-workbench-search" });
    const searchLabel = this.searchBox.createEl("label", {
      cls: "rss-workbench-search-label",
    });
    searchLabel.createSpan({
      cls: "rss-dashell-visually-hidden",
      text: "搜索文章",
    });
    this.search = searchLabel.createEl("input", {
      type: "search",
      placeholder: "搜索标题或正文",
    });
    this.clearSearch = readerIcon(this.searchBox, "x", "清除搜索", () => {
      this.search.value = "";
      this.state.query = "";
      this.clearSearch.hidden = true;
      this.renderList();
      this.scheduleSave();
      this.search.focus();
    });
    this.search.addEventListener("input", () => {
      this.state.query = this.search.value.slice(0, 500);
      this.limit = 80;
      this.clearSearch.hidden = !this.state.query;
      this.renderList();
      this.scheduleSave();
    });
    this.search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.toggleSearch(false);
      }
    });
    this.list = sidebar.createDiv({
      cls: "rss-workbench-list",
      attr: { tabindex: "0", "aria-label": "文章列表" },
    });
    const handle = layout.createDiv({
      cls: "rss-workbench-resize",
      attr: {
        role: "separator",
        tabindex: "0",
        "aria-orientation": "vertical",
        "aria-label": "调整文章列表宽度",
        "aria-valuemin": "220",
        "aria-valuemax": "520",
      },
    });
    const resize = (value: number) => {
      this.prefs.listWidth = value;
      setCssProps(root, { "--rss-workbench-list-width": `${value}px` });
      handle.setAttribute("aria-valuenow", String(value));
    };
    resize(this.prefs.listWidth);
    this.clearResize = bindListResize({
      handle,
      root,
      current: () => this.prefs.listWidth,
      change: resize,
      save: () => this.scheduleSave(),
    });
    this.reader = layout.createEl("section", {
      cls: "rss-workbench-reader",
      attr: { tabindex: "0", "aria-label": "文章正文" },
    });
    this.list.addEventListener("scroll", () => this.scheduleSave());
    applyWorkbenchFormat(root, options.settings.readerFormat);
    this.refresh();
    this.restoreChannel();
  }

  private get state(): ChannelState {
    return (
      this.prefs.channels[this.prefs.channel] ??
      (this.prefs.channels[this.prefs.channel] = newChannel())
    );
  }
  private remember(): void {
    if (this.list.clientHeight) this.state.listTop = this.list.scrollTop;
    if (this.body?.clientHeight && this.selected)
      this.state.readerTop = this.body.scrollTop;
  }
  private scheduleSave(): void {
    if (this.closed) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.remember();
      void this.run(this.options.savePreferences);
    }, 500);
  }
  private async run(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      new Notice(displayError(error));
    }
  }
  refresh(): void {
    if (this.closed) return;
    this.channelButton.empty();
    this.channelButton.createSpan({
      text:
        channelChoices(this.options.feeds()).find(
          (choice) => choice.id === this.prefs.channel,
        )?.label ?? "全部订阅",
    });
    setIcon(
      this.channelButton.createSpan({ cls: "rss-workbench-channel-chevron" }),
      "chevron-down",
    );
    this.renderFilters();
    this.renderList();
    this.applyFocus();
    applyWorkbenchFormat(this.options.root, this.options.settings.readerFormat);
    if (this.selected) this.renderToolbar();
  }
  private filtered(): FeedItem[] {
    const channel = this.prefs.channel;
    const feeds = this.options.feeds();
    const urls = new Set(
      feeds
        .filter(
          (feed) =>
            channel === "@all" ||
            feed.url === channel ||
            (channel.startsWith("@folder:") &&
              (feed.folder === channel.slice(8) ||
                feed.folder.startsWith(`${channel.slice(8)}/`))),
        )
        .map((feed) => feed.url),
    );
    const query = this.state.query.toLocaleLowerCase();
    return this.options
      .items()
      .filter(
        (item) =>
          urls.has(item.feedUrl) &&
          (this.state.filter !== "unread" ||
            !item.read ||
            this.unreadSession.has(entryId(item))) &&
          (this.state.filter !== "favorites" || item.starred) &&
          (!query ||
            `${item.title} ${item.description} ${item.content ?? ""}`
              .toLocaleLowerCase()
              .includes(query)),
      );
  }
  private renderList(): void {
    const top = this.list.scrollTop;
    this.list.empty();
    const items = this.filtered();
    for (const item of items.slice(0, this.limit)) {
      renderEntry(
        this.list,
        item,
        !!this.selected && entryId(item) === entryId(this.selected),
        () => {
          void this.open(item);
        },
      );
    }
    if (!items.length)
      this.list.createDiv({
        cls: "rss-workbench-empty",
        text: this.options.feeds().length
          ? "没有符合条件的文章"
          : "尚未添加订阅",
      });
    if (items.length > this.limit) {
      const more = this.list.createEl("button", {
        cls: "rss-workbench-load-more",
        text: "加载更多",
        attr: { type: "button" },
      });
      more.addEventListener("click", () => {
        this.limit += 80;
        this.renderList();
      });
    }
    this.list.scrollTop = top;
  }
  private renderFilters(): void {
    this.filters.empty();
    for (const [filter, label] of [
      ["all", "全部"],
      ["unread", "未读"],
      ["favorites", "收藏"],
    ] as const) {
      const button = this.filters.createEl("button", {
        text: label,
        attr: {
          type: "button",
          "aria-pressed": String(this.state.filter === filter),
        },
      });
      button.addEventListener("click", () => this.setFilter(filter));
    }
    readerIcon(this.filters, "settings", "插件设置", this.options.openSettings);
  }
  setFilter(filter: ReadingFilter): void {
    this.state.filter = filter;
    this.unreadSession.clear();
    this.limit = 80;
    this.renderFilters();
    this.renderList();
    this.scheduleSave();
  }
  setChannel(channel: string): void {
    if (this.closed || this.prefs.channel === channel) return;
    this.remember();
    this.prefs.channel = channel;
    this.limit = 80;
    this.unreadSession.clear();
    this.clearArticle();
    this.selected = null;
    this.restoreChannel();
    this.refresh();
    this.scheduleSave();
  }
  private restoreChannel(): void {
    this.search.value = this.state.query;
    this.searchBox.hidden = !this.state.query;
    this.clearSearch.hidden = !this.state.query;
    this.renderList();
    this.list.scrollTop = this.state.listTop;
    const selected = this.filtered().find(
      (item) => entryId(item) === this.state.selectedId,
    );
    if (selected) void this.open(selected, true);
    else this.renderEmpty();
  }
  private pickChannel(): void {
    if (this.options.app)
      new ChannelPicker(
        this.options.app,
        channelChoices(this.options.feeds()),
        (id) => this.setChannel(id),
      ).open();
  }
  toggleSearch(show = this.searchBox.hidden): void {
    this.searchBox.hidden = !show;
    if (show) this.search.focus();
  }
  private applyFocus(): void {
    this.options.root.toggleClass("rss-workbench-focused", this.prefs.focused);
  }
  toggleList(): void {
    this.prefs.focused = !this.prefs.focused;
    this.options.root.removeClass("rss-workbench-mobile-reading");
    this.applyFocus();
    this.renderToolbar();
    this.scheduleSave();
  }
  focusList(): void {
    this.prefs.focused = false;
    this.applyFocus();
    this.list.focus();
  }
  focusReader(): void {
    this.body?.focus();
  }
  navigate(direction: number): void {
    const items = this.filtered();
    const index = this.selected
      ? items.findIndex((item) => entryId(item) === entryId(this.selected!))
      : -1;
    const next = items[index < 0 ? 0 : index + direction];
    if (next) void this.open(next);
  }
  async open(item: FeedItem, restore = false): Promise<void> {
    if (this.closed) return;
    if (!restore) this.remember();
    const top = restore ? this.state.readerTop : 0;
    this.clearArticle();
    const request = this.request;
    this.selected = item;
    this.options.selectArticle(item);
    this.state.selectedId = entryId(item);
    this.state.readerTop = top;
    if (this.state.filter === "unread") this.unreadSession.add(entryId(item));
    this.renderList();
    this.reader.empty();
    this.renderToolbar();
    this.options.root.addClass("rss-workbench-mobile-reading");
    const body = this.reader.createDiv({
      cls: "rss-reader-content rss-workbench-body inline-reader-content",
      attr: { tabindex: "0" },
    });
    this.body = body;
    body.createDiv({
      cls: "rss-workbench-empty",
      text: "正在加载…",
      attr: { role: "status" },
    });
    body.addEventListener("scroll", () => this.scheduleSave());
    try {
      if (!item.read && this.options.settings.display.autoMarkReadOnOpen)
        await this.options.update(item, { read: true });
      if (this.closed || request !== this.request) return;
      body.empty();
      const cleanup = await this.options.renderArticle(body, item);
      if (this.closed || request !== this.request) {
        if (cleanup) cleanup();
        return;
      }
      this.cleanupArticle = cleanup || undefined;
      body
        .querySelectorAll("details.rss-reader-description-callout")
        .forEach((el) => {
          (el as HTMLDetailsElement).open = false;
        });
      this.clearScroll = restoreReadingScroll(body, top);
      this.renderList();
      this.scheduleSave();
    } catch (error) {
      if (this.closed || request !== this.request) return;
      body.empty();
      body.createDiv({
        cls: "rss-workbench-empty",
        text: displayError(error),
        attr: { role: "alert" },
      });
      body
        .createEl("button", { text: "重试" })
        .addEventListener("click", () => {
          void this.open(item);
        });
    }
  }
  private renderEmpty(): void {
    this.reader.empty();
    const toolbar = this.reader.createDiv({
      cls: "rss-dashell-reader-toolbar rss-reader-header",
    });
    readerIcon(toolbar, "panel-left-open", "选择频道", () =>
      this.pickChannel(),
    );
    this.reader.createDiv({ cls: "rss-workbench-empty", text: "选择一篇文章" });
  }
  private renderToolbar(): void {
    if (!this.selected || this.closed) return;
    const item = this.selected;
    workbenchToolbar({
      reader: this.reader,
      item,
      focused: this.prefs.focused,
      fold: () => this.toggleList(),
      navigate: (direction) => this.navigate(direction),
      update: (changes) => {
        void this.run(async () => {
          await this.options.update(item, changes);
          this.refresh();
        });
      },
      save: () => {
        void this.run(async () => {
          await this.options.saveArticle(item);
          this.refresh();
        });
      },
      excerpt: this.options.saveExcerpt ? () => this.excerpt(item) : undefined,
      more: (anchor) =>
        workbenchMenu({
          anchor,
          item,
          format: () => this.openFormat(anchor),
          reload: () => {
            void this.open(item);
          },
          pickChannel: () => this.pickChannel(),
          manageFeeds: this.options.manageFeeds,
          back: this.options.back,
        }),
    });
  }
  private excerpt(item: FeedItem): void {
    const selection = this.options.root.ownerDocument.getSelection();
    if (
      !selection?.rangeCount ||
      !this.body?.contains(selection.getRangeAt(0).commonAncestorContainer) ||
      !selection.toString().trim()
    ) {
      new Notice("请先选择正文中的文字。");
      return;
    }
    const text = selection.toString();
    void this.run(() => this.options.saveExcerpt!(item, text));
  }
  private openFormat(anchor: HTMLElement): void {
    this.formatPortal?.close(true);
    this.formatPortal = createReaderFormatPortal({
      anchor,
      format: this.options.settings.readerFormat,
      defaults: DEFAULT_SETTINGS.readerFormat,
      applyFormat: () =>
        applyWorkbenchFormat(
          this.options.root,
          this.options.settings.readerFormat,
        ),
      scheduleSave: () => this.scheduleSave(),
      flushSave: () => this.run(this.options.savePreferences),
      openReaderDisplaySettings: this.options.openSettings,
      onClosed: () => {
        this.formatPortal = undefined;
      },
    });
  }
  private clearArticle(): void {
    this.request++;
    this.clearScroll?.();
    this.clearScroll = undefined;
    this.cleanupArticle?.();
    this.cleanupArticle = undefined;
    this.formatPortal?.close(true);
    this.formatPortal = undefined;
    this.options.disposeArticle();
    this.body = null;
  }
  dispose(): void {
    if (this.closed) return;
    this.remember();
    this.closed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.clearResize();
    this.clearArticle();
    void this.run(this.options.savePreferences);
  }
}
