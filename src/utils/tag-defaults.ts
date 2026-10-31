import type { RssDashboardSettings, Tag, Folder } from "../types/types";
import { DEFAULT_TAG_COLOR, DEFAULT_TAG_TEXT_COLOR } from "./tag-colors";

/** Future-only changes pin inherited stored copies before changing the defaults. */
export function applyTagDefaults(
  settings: RssDashboardSettings,
  colors: { background: string; text: string },
  futureOnly: boolean,
): void {
  const tags: Tag[] = [...settings.availableTags];
  for (const feed of settings.feeds) {
    for (const item of feed.items) tags.push(...(item.tags ?? []));
  }
  const collect = (folders: Folder[]): void => {
    for (const folder of folders) {
      tags.push(...(folder.autoTags ?? []));
      collect(folder.subfolders ?? []);
    }
  };
  collect(settings.folders);
  if (futureOnly) {
    for (const tag of tags) {
      tag.color ??= settings.defaultTagColor ?? DEFAULT_TAG_COLOR;
      tag.textColor ??= settings.defaultTagTextColor ?? DEFAULT_TAG_TEXT_COLOR;
    }
  }
  settings.defaultTagColor = colors.background;
  settings.defaultTagTextColor = colors.text;
}
