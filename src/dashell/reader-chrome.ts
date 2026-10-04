// Adapted from Qiaomu AI RSS src/view.ts at ac2c792 (GPL-3.0-only).
// Keep RSS Dashboard's action/state ownership and Obsidian theme variables.
import { setIcon, setTooltip } from "obsidian";

export function readerIcon(
  parent: HTMLElement,
  icon: string,
  label: string,
  run: () => void,
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "rss-dashell-reader-icon",
    attr: { type: "button" },
  });
  setIcon(button, icon);
  setTooltip(button, label);
  button.addEventListener("click", run);
  return button;
}

export function readerStart(
  parent: HTMLElement,
  previous: () => void,
  next: () => void,
): HTMLElement {
  const slot = parent.createDiv({ cls: "rss-dashell-reader-version-slot" });
  const label = slot.createEl("label", {
    cls: "rss-dashell-mode-label",
    text: "阅读版本",
  });
  const select = label.createEl("select", { cls: "rss-dashell-reader-mode" });
  select.createEl("option", { value: "original", text: "原文" });
  select.disabled = true;
  const nav = parent.createDiv({ cls: "rss-dashell-reader-nav" });
  readerIcon(nav, "chevron-up", "上一篇", previous);
  readerIcon(nav, "chevron-down", "下一篇", next);
  // The workspace tab and article heading already show the title.
  return parent.createDiv({
    cls: "rss-reader-title rss-dashell-visually-hidden",
    text: "Dashell RSS",
  });
}
