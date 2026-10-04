import { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type RssDashboardPlugin from "../../../main";
import { renderDisplaySettingsTab } from "../../../src/settings/tabs/display-settings-tab";
import { renderGeneralSettingsTab } from "../../../src/settings/tabs/general-settings-tab";
import { DEFAULT_SETTINGS } from "../../../src/types/types";
import { installObsidianDomPolyfills } from "../test-dom-polyfills";

beforeEach(() => {
  installObsidianDomPolyfills();
  document.body.empty();
});

describe("Reading configuration ownership", () => {
  it.each([true, false])(
    "shows RSS reading controls only without the learning handoff (enabled=%s)",
    (enabled) => {
      const settings = structuredClone(DEFAULT_SETTINGS);
      settings.readerFormat.fontScalePct = 150;
      settings.readerViewLocation = "left-sidebar";
      const before = structuredClone(settings);
      const saveSettings = vi.fn(async () => {});
      const plugin = {
        app: App.createMock(),
        settings,
        saveSettings,
        dashellLearning: enabled ? {} : undefined,
        getImageCacheSizeBytes: () => 0,
        getActiveDashboardView: vi.fn(async () => null),
      } as unknown as RssDashboardPlugin;
      const general = document.body.createDiv();
      const display = document.body.createDiv();
      renderGeneralSettingsTab(general, plugin);
      renderDisplaySettingsTab(display, plugin, () => {});
      const names = (element: HTMLElement) =>
        Array.from(
          element.querySelectorAll(".setting-item-name"),
          (el) => el.textContent,
        );
      for (const name of [
        "Reader view location",
        "Saved article open location",
        "Use web viewer",
      ])
        expect(names(general).includes(name)).toBe(!enabled);
      expect(names(general).includes("媒体预览位置")).toBe(enabled);
      for (const name of [
        "Reader",
        "Font size",
        "Line height",
        "Reset reader format",
      ])
        expect(names(display).includes(name)).toBe(!enabled);
      expect(names(general)).toContain("View style");
      expect(names(display)).toContain("Show cover images");
      expect(settings).toEqual(before);
      expect(saveSettings).not.toHaveBeenCalled();
    },
  );
});
