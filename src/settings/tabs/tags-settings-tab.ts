/**
 * Tags Settings Tab renderer.
 *
 * Extracted from the monolithic settings-tab.ts.
 * Exports:
 *   - renderTagsSettingsTab(containerEl, plugin, onRefresh)
 */
import { Notice, Setting } from "obsidian";
import RssDashboardPlugin from "../../../main";
import { addTagMultiSelectControl } from "../../components/tag-multi-select-control";
import { DEFAULT_SETTINGS } from "../../types/types";
import { applyTagAppearance } from "../../utils/tag-colors";
import { showEditTagModal } from "../../utils/tag-utils";
import { deleteTagFromSettings } from "../../utils/tag-settings";
import { renderTagDefaultsControl } from "./tag-defaults-control";

interface AutoTagSettingConfig {
  name: string;
  description: string;
  menuTitle: string;
  getSelectedTagNames: () => string[];
  setSelectedTagNames: (selected: string[]) => void;
}

export function renderTagsSettingsTab(
  containerEl: HTMLElement,
  plugin: RssDashboardPlugin,
  onRefresh: () => void,
): () => void {
  // Auto Tagging settings
  new Setting(containerEl).setName("Auto tagging").setHeading();

  const autoTagSettings: AutoTagSettingConfig[] = [
    {
      name: "Tag for video articles",
      description:
        "Default tag for RSS articles with detected video content (YouTube feeds use the dedicated tag below)",
      menuTitle: "Select default video tags",
      getSelectedTagNames: () => plugin.settings.media.defaultVideoTags ?? [],
      setSelectedTagNames: (selected) => {
        plugin.settings.media.defaultVideoTags = selected;
      },
    },
    {
      name: "Default Mastodon tag",
      description: "Default tag for Mastodon feeds",
      menuTitle: "Select default Mastodon tags",
      getSelectedTagNames: () =>
        plugin.settings.media.defaultMastodonTags ?? [],
      setSelectedTagNames: (selected) => {
        plugin.settings.media.defaultMastodonTags = selected;
      },
    },
    {
      name: "Default YouTube tag",
      description: "Tag used for auto-tagged YouTube content",
      menuTitle: "Select default YouTube tags",
      getSelectedTagNames: () => plugin.settings.media.defaultYouTubeTags ?? [],
      setSelectedTagNames: (selected) => {
        plugin.settings.media.defaultYouTubeTags = selected;
      },
    },
    {
      name: "Default podcast tag",
      description: "Default tag for podcast episodes",
      menuTitle: "Select default podcast tags",
      getSelectedTagNames: () => plugin.settings.media.defaultPodcastTags ?? [],
      setSelectedTagNames: (selected) => {
        plugin.settings.media.defaultPodcastTags = selected;
      },
    },
    {
      name: "Default RSS tag",
      description: "Default tag for RSS articles",
      menuTitle: "Select default RSS tags",
      getSelectedTagNames: () => plugin.settings.media.defaultRssTags ?? [],
      setSelectedTagNames: (selected) => {
        plugin.settings.media.defaultRssTags = selected;
      },
    },
    {
      name: "Default smallweb tag",
      description: "Default tag for smallweb articles",
      menuTitle: "Select default smallweb tags",
      getSelectedTagNames: () =>
        plugin.settings.media.defaultSmallwebTags ?? [],
      setSelectedTagNames: (selected) => {
        plugin.settings.media.defaultSmallwebTags = selected;
      },
    },
  ];

  for (const autoTagSetting of autoTagSettings) {
    const setting = new Setting(containerEl)
      .setName(autoTagSetting.name)
      .setDesc(autoTagSetting.description);

    addTagMultiSelectControl({
      tagAppearanceSettings: plugin.settings,
      setting,
      availableTags: plugin.settings.availableTags ?? [],
      selectedTagNames: autoTagSetting.getSelectedTagNames(),
      triggerEmptyLabel: "None",
      menuTitle: autoTagSetting.menuTitle,
      onChange: async (selected: string[]) => {
        autoTagSetting.setSelectedTagNames(selected);
        await plugin.saveSettings();
      },
    });
  }

  new Setting(containerEl)
    .setName("Reset tag names")
    .setDesc("Restore all tag names to their out-of-the-box defaults.")
    .addButton((button) => {
      button.setButtonText("Default tag names").onClick(async () => {
        const d = DEFAULT_SETTINGS.media;
        plugin.settings.media.defaultVideoTag = d.defaultVideoTag;
        plugin.settings.media.defaultVideoTags = d.defaultVideoTags;
        plugin.settings.media.defaultYouTubeTag = d.defaultYouTubeTag;
        plugin.settings.media.defaultYouTubeTags = d.defaultYouTubeTags;
        plugin.settings.media.defaultPodcastTags = d.defaultPodcastTags;
        plugin.settings.media.defaultRssTag = d.defaultRssTag;
        plugin.settings.media.defaultRssTags = d.defaultRssTags;
        plugin.settings.media.defaultSmallwebTag = d.defaultSmallwebTag;
        plugin.settings.media.defaultSmallwebTags = d.defaultSmallwebTags;
        plugin.settings.media.defaultMastodonTag = d.defaultMastodonTag;
        plugin.settings.media.defaultMastodonTags = d.defaultMastodonTags;
        await plugin.saveSettings();
        new Notice("Tag names restored to defaults.");
        onRefresh();
      });
    });

  const cleanup = renderTagDefaultsControl(containerEl, plugin);

  // Tags settings
  new Setting(containerEl).setName("Tags").setHeading();

  const tagsContainer = containerEl.createDiv({
    cls: "rss-dashboard-tags-container",
  });

  for (let i = 0; i < plugin.settings.availableTags.length; i++) {
    const tag = plugin.settings.availableTags[i];
    if (!tag) continue;

    const row = new Setting(tagsContainer).setName(tag.name);
    const chip = row.descEl.createSpan({ cls: "rss-dashboard-tag-badge", text: tag.name });
    applyTagAppearance(chip, tag, plugin.settings);
    row.addButton(button => button.setButtonText("Edit").onClick(() => {
      showEditTagModal({ app: plugin.app, settings: plugin.settings, tag, onSave: async () => {
        await plugin.saveSettings();
        await plugin.refreshOpenTagColorViews();
        plugin.app.workspace.trigger("rss-dashboard:tags-mutated");
        onRefresh();
      }});
    })).addButton(button => button.setIcon("trash").setTooltip("Delete tag").onClick(async () => {
      deleteTagFromSettings(plugin.settings, tag.name);
      await plugin.saveSettings();
      onRefresh();
    }));
  }
  new Setting(containerEl).setName("Add new tag").addButton(button => button.setButtonText("Add tag").onClick(() => {
    showEditTagModal({ app: plugin.app, settings: plugin.settings, tag: { name: "" }, isNew: true,
      onSave: async () => { await plugin.saveSettings(); onRefresh(); } });
  }));
  return cleanup;
}
