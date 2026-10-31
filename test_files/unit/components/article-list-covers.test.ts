import { afterEach, describe, expect, it, vi } from "vitest";
import * as covers from "../../../src/services/page-cover-fetch";
import {
  createArticleListInstance,
  setupArticleListBeforeEach,
  teardownArticleListAfterEach,
} from "./article-list-component-fixtures";

describe("page cover results after the list changes", () => {
  afterEach(teardownArticleListAfterEach);
  it.each(["destroy", "delete-feed"])(
    "does not commit an in-flight result after %s",
    async (action) => {
      const { container, settings, articles, mockCallbacks } =
        setupArticleListBeforeEach();
      articles[0].link = "https://example.com/article";
      settings.feeds = [
      { url: articles[0].feedUrl, title: "Test", items: articles, folder: "", lastUpdated: 0 },
      ];
      let finish!: (value: string) => void;
      const request = vi.spyOn(covers, "fetchPageCover").mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const list = createArticleListInstance(
        container,
        settings,
        articles.slice(0, 1),
        mockCallbacks,
      );
      list.render();
      container
        .querySelector<HTMLButtonElement>(".rss-dashboard-fetch-all-covers")!
        .click();
      expect(request).toHaveBeenCalledOnce();
      if (action === "destroy") list.destroy();
      else settings.feeds = [];
      finish("https://example.com/cover.png");
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      expect(mockCallbacks.onArticleUpdate).not.toHaveBeenCalled();
      expect(articles[0].coverImageFromPage).not.toBe(true);
      list.destroy();
    },
  );
});
