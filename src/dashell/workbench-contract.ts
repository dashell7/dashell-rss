import type { App } from "obsidian";
import type { Feed, FeedItem, RssDashboardSettings } from "../types/types";

export interface WorkbenchOptions {
  root: HTMLElement;
  settings: RssDashboardSettings;
  app?: App;
  feeds: () => Feed[];
  items: () => FeedItem[];
  renderArticle: (
    body: HTMLElement,
    item: FeedItem,
  ) => Promise<void | (() => void)>;
  disposeArticle: () => void;
  update: (item: FeedItem, changes: Partial<FeedItem>) => Promise<void>;
  saveArticle: (item: FeedItem) => Promise<void>;
  saveExcerpt?: (item: FeedItem, text: string) => Promise<void>;
  selectArticle: (item: FeedItem) => void;
  refresh: () => Promise<void>;
  manageFeeds: () => void;
  openSettings: () => void;
  back?: () => void;
  savePreferences: () => Promise<void>;
}
