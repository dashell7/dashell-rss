import { SETTINGS_TEXT_BASE } from "./settings-copy-base";
import { SETTINGS_TEXT_EXTRA } from "./settings-copy-extra";

const SETTINGS_TAB_LABELS: Record<string, string> = {
  General: "常规",
  Storage: "存储",
  Display: "显示",
  Sidebar: "侧边栏",
  Media: "媒体",
  "Article saving": "文章保存",
  英语学习: "英语学习",
  Rules: "规则",
  Highlights: "高亮",
  "Import/Export": "导入/导出",
  Tags: "标签",
  About: "关于",
};

const SETTINGS_TEXT: Record<string, string> = {
  ...SETTINGS_TEXT_BASE,
  ...SETTINGS_TEXT_EXTRA,
};

function translateDynamicText(value: string): string | undefined {
  const editMatch = /^Edit "(.+)"$/.exec(value);
  if (editMatch) return `编辑“${editMatch[1]}”`;

  const deleteMatch = /^Delete "(.+)"$/.exec(value);
  if (deleteMatch) return `删除“${deleteMatch[1]}”`;

  const moveMatch = /^Move (.+) (up|down)$/.exec(value);
  if (moveMatch?.[1] && moveMatch[2]) {
    const itemName = moveMatch[1];
    const label = SETTINGS_TEXT[itemName] ?? itemName;
    return `将“${label}”${moveMatch[2] === "up" ? "上移" : "下移"}`;
  }

  const dragMatch = /^Drag to reorder (.+)$/.exec(value);
  if (dragMatch?.[1]) {
    const itemName = dragMatch[1];
    const label = SETTINGS_TEXT[itemName] ?? itemName;
    return `拖动以调整“${label}”的顺序`;
  }

  const cacheMatch = /^Cached image storage: (.+)\.$/.exec(value);
  if (cacheMatch) return `图片缓存占用：${cacheMatch[1]}。`;

  const whatsNewMatch = /^What's new in (v.+)\?$/.exec(value);
  if (whatsNewMatch) return `查看 ${whatsNewMatch[1]} 更新内容`;

  const leftoverMatch =
    /^A user-state\.json from a previous shard storage v2 setup is still at (.+)\. It is not read in the current storage mode, and is kept as a backup of read, starred, tagged, and saved state\. Delete it manually once you no longer need it\.$/.exec(
      value,
    );
  if (leftoverMatch) {
    return `旧版分片存储 v2 的 user-state.json 仍位于 ${leftoverMatch[1]}。当前存储模式不会读取此文件，它作为已读、星标、标签和已保存状态的备份保留。不再需要时可手动删除。`;
  }

  if (value.includes(" | ")) {
    return value
      .split(" | ")
      .map((part) => SETTINGS_TEXT[part] ?? part)
      .join(" | ");
  }

  const profileImagesMatch =
    /^Profile images loaded for (\d+) (.+) feeds?\.$/.exec(value);
  if (profileImagesMatch) {
    return `${profileImagesMatch[2]} 订阅源的头像已加载 ${profileImagesMatch[1]} 个。`;
  }

  if (value.includes(" • ") && value.startsWith("Mode: ")) {
    return value
      .split(" • ")
      .map((part) => {
        if (part.startsWith("Mode: ")) {
          const mode = part.slice("Mode: ".length);
          const modeLabel =
            mode === "legacy-json"
              ? "旧版 JSON"
              : mode === "vault-shards"
                ? "分片存储 v1"
                : mode === "vault-shards-v2"
                  ? "分片存储 v2"
                  : mode;
          return `模式：${modeLabel}`;
        }
        if (part.startsWith("Folder: ")) return `文件夹：${part.slice(8)}`;
        if (part.startsWith("Metadata: ")) return `metadata：${part.slice(10)}`;
        if (part.startsWith("Feeds: ")) return `订阅源：${part.slice(7)}`;
        if (part.startsWith("Shards: ")) return `分片：${part.slice(8)}`;
        return SETTINGS_TEXT[part] ?? part;
      })
      .join(" • ");
  }

  return undefined;
}

export function getSettingsTabLabel(tabName: string): string {
  return SETTINGS_TAB_LABELS[tabName] ?? tabName;
}

export function translateSettingsText(value: string): string {
  const trimmed = value.trim();
  return SETTINGS_TEXT[trimmed] ?? translateDynamicText(trimmed) ?? value;
}
