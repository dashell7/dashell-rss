import { describe, expect, it } from "vitest";
import {
  getSettingsTabLabel,
  translateSettingsText,
} from "../../../src/settings/chinese-localization";
import { localizeSettingsElement } from "../../../src/settings/settings-dom-localizer";

function flushMutations(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("Chinese settings localization", () => {
  it("shows Chinese tab names without changing internal tab IDs", () => {
    expect(getSettingsTabLabel("Highlights")).toBe("高亮");
    expect(getSettingsTabLabel("Import/Export")).toBe("导入/导出");
    expect(getSettingsTabLabel("英语学习")).toBe("英语学习");
    expect(getSettingsTabLabel("Unregistered tab")).toBe("Unregistered tab");
  });

  it("translates dynamic storage status while preserving paths and counts", () => {
    expect(
      translateSettingsText(
        "Mode: vault-shards-v2 • Folder: .rss-data • Metadata: Notes/meta • Feeds: 8 • Shards: 8 • Migration ready • Shard Storage v2 active",
      ),
    ).toBe(
      "模式：分片存储 v2 • 文件夹：.rss-data • metadata：Notes/meta • 订阅源：8 • 分片：8 • 可以迁移 • 分片存储 v2 已启用",
    );
  });

  it("localizes visible controls and dynamic additions without changing values or user content", async () => {
    const root = document.body.createDiv();
    const heading = root.createEl("h3");
    heading.textContent = "Enable word highlighting";

    const option = root.createEl("option");
    option.value = "vault-shards-v2";
    option.textContent = "Shard storage v2";

    const input = root.createEl("input");
    input.placeholder = "Enter word to highlight";
    input.value = "leave this value alone";

    const tooltip = root.createEl("button");
    tooltip.setAttribute("aria-label", "Toggle case sensitivity");

    const customTags = root.createDiv();
    customTags.className = "rss-dashboard-tags-container";
    customTags.createDiv({ cls: "setting-item-name", text: "Podcast" });

    const deleteTag = customTags.createEl("button");
    deleteTag.setAttribute("aria-label", "Delete tag");

    const selectedTag = root.createSpan({
      cls: "rss-dashboard-tag-multi-select-trigger-label",
      text: "Podcast",
    });
    const menuTag = root.createSpan({
      cls: "rss-dashboard-tag-multi-select-menu-option-label",
      text: "Podcast",
    });

    const customWord = root.createSpan();
    customWord.className = "rss-dashboard-highlight-word-name-click";
    customWord.textContent = "Whole word only";

    const cleanup = localizeSettingsElement(root);

    expect(heading.textContent).toBe("启用单词高亮");
    expect(option.textContent).toBe("分片存储 v2");
    expect(option.value).toBe("vault-shards-v2");
    expect(input.placeholder).toBe("输入要高亮的单词");
    expect(input.value).toBe("leave this value alone");
    expect(tooltip.getAttribute("aria-label")).toBe("切换大小写敏感");
    expect(customTags.querySelector(".setting-item-name")?.textContent).toBe(
      "Podcast",
    );
    expect(deleteTag.getAttribute("aria-label")).toBe("删除标签");
    expect(selectedTag.textContent).toBe("Podcast");
    expect(menuTag.textContent).toBe("Podcast");
    expect(customWord.textContent).toBe("Whole word only");

    const addedControl = root.createEl("button");
    addedControl.textContent = "Podcast player";
    await flushMutations();
    expect(addedControl.textContent).toBe("播客播放器");

    cleanup();
    const afterCleanup = root.createSpan();
    afterCleanup.textContent = "Podcast player";
    await flushMutations();
    expect(afterCleanup.textContent).toBe("Podcast player");
  });
});
