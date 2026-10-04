import { Menu } from "obsidian";
import { readerIcon, readerStart } from "./reader-chrome";
import type { FeedItem } from "../types/types";
import { safeUrl } from "./safety";

export function workbenchToolbar(options: {
  reader: HTMLElement;
  item: FeedItem;
  focused: boolean;
  fold: () => void;
  navigate: (direction: number) => void;
  update: (changes: Partial<FeedItem>) => void;
  save: () => void;
  excerpt?: () => void;
  more: (anchor: HTMLElement) => void;
}): void {
  const { reader, item } = options;
  const old = reader.querySelector<HTMLElement>(".rss-reader-header");
  // Preserve mounted learning subscriptions and the current source version.
  const version = old?.querySelector(".rss-dashell-reader-version-slot");
  const learning = old?.querySelector(".rss-dashell-learning-slot");
  const toolbar = reader.createDiv({
    cls: "rss-reader-header rss-dashell-reader-toolbar",
  });
  readerIcon(
    toolbar,
    options.focused ? "panel-left-open" : "panel-left-close",
    options.focused ? "展开文章列表" : "收起文章列表",
    options.fold,
  );
  readerStart(
    toolbar,
    () => options.navigate(-1),
    () => options.navigate(1),
  );
  if (version)
    toolbar
      .querySelector(".rss-dashell-reader-version-slot")
      ?.replaceWith(version);
  const actions = toolbar.createDiv({ cls: "rss-reader-actions" });
  const bookmark = readerIcon(
    actions,
    "bookmark",
    item.starred ? "取消收藏" : "收藏",
    () => options.update({ starred: !item.starred }),
  );
  bookmark.setAttribute("aria-pressed", String(!!item.starred));
  bookmark.toggleClass("is-bookmarked", !!item.starred);
  readerIcon(
    actions,
    item.read ? "circle-check" : "circle",
    item.read ? "标记未读" : "标记已读",
    () => options.update({ read: !item.read }),
  );
  readerIcon(
    actions,
    item.saved ? "file-check" : "file-plus",
    item.saved ? "打开已保存笔记" : "保存为笔记",
    options.save,
  );
  if (options.excerpt)
    readerIcon(actions, "notebook-pen", "摘录选中文字", options.excerpt);
  actions.appendChild(
    learning ?? actions.createDiv({ cls: "rss-dashell-learning-slot" }),
  );
  const more = readerIcon(actions, "ellipsis", "更多操作", () =>
    options.more(more),
  );
  if (old) old.replaceWith(toolbar);
  else reader.prepend(toolbar);
}

export function workbenchMenu(options: {
  anchor: HTMLElement;
  item: FeedItem;
  format: () => void;
  reload: () => void;
  pickChannel: () => void;
  manageFeeds: () => void;
  back?: () => void;
}): void {
  const { anchor, item } = options;
  const menu = new Menu();
  menu.addItem((entry) =>
    entry.setTitle("阅读设置…").setIcon("type").onClick(options.format),
  );
  menu.addSeparator();
  const url = safeUrl(item.link);
  if (url)
    menu.addItem((entry) =>
      entry
        .setTitle("在浏览器打开原文")
        .setIcon("external-link")
        .onClick(() =>
          anchor.ownerDocument.defaultView?.open(
            url,
            "_blank",
            "noopener,noreferrer",
          ),
        ),
    );
  menu.addItem((entry) =>
    entry
      .setTitle("重新加载文章")
      .setIcon("refresh-cw")
      .onClick(options.reload),
  );
  menu.addItem((entry) =>
    entry.setTitle("选择频道").setIcon("rss").onClick(options.pickChannel),
  );
  menu.addItem((entry) =>
    entry
      .setTitle("管理订阅")
      .setIcon("settings-2")
      .onClick(options.manageFeeds),
  );
  if (options.back) {
    menu.addSeparator();
    menu.addItem((entry) =>
      entry
        .setTitle("返回订阅首页")
        .setIcon("arrow-left")
        .onClick(options.back!),
    );
  }
  const rect = anchor.getBoundingClientRect();
  menu.showAtPosition({ x: rect.left, y: rect.bottom });
}
