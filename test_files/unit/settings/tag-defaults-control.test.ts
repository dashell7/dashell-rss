import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import {
  DEFAULT_SETTINGS,
  type RssDashboardSettings,
} from "../../../src/types/types";
import { renderTagDefaultsControl } from "../../../src/settings/tabs/tag-defaults-control";
import { resolveTagAppearance } from "../../../src/utils/tag-colors";
import { installObsidianDomPolyfills } from "../test-dom-polyfills";

beforeEach(() => {
  installObsidianDomPolyfills();
  document.body.empty();
});
describe("tag default drafts", () => {
  it("allows retry after a save failure without an unhandled rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const settings: RssDashboardSettings = JSON.parse(
      JSON.stringify(DEFAULT_SETTINGS),
    );
    const app = App.createMock();
    app.workspace.trigger = vi.fn();
    const plugin = {
      app,
      settings,
      saveSettings: vi
        .fn()
        .mockRejectedValueOnce(new Error("disk"))
        .mockResolvedValue(undefined),
      refreshOpenTagColorViews: vi.fn(async () => {}),
    };
    const root = document.body.createDiv();
    const cleanup = renderTagDefaultsControl(root, plugin);
    const button = Array.from(root.querySelectorAll("button")).find(
      (el) => el.textContent === "Future tags only",
    )!;
    button.click();
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(button.disabled).toBe(false);
    button.click();
    await vi.waitFor(() =>
      expect(plugin.refreshOpenTagColorViews).toHaveBeenCalledOnce(),
    );
    cleanup();
    error.mockRestore();
  });
  it.each([false, true])(
    "applies the draft only after the chosen scope is pressed (future only: %s)",
    async (futureOnly) => {
      const settings: RssDashboardSettings = JSON.parse(
        JSON.stringify(DEFAULT_SETTINGS),
      );
      settings.availableTags = [
        { name: "Inherited" },
        { name: "Custom", color: "#123456", textColor: "#abcdef" },
      ];
      const plugin = {
        app: App.createMock(),
        settings,
        saveSettings: vi.fn(async () => {}),
        refreshOpenTagColorViews: vi.fn(async () => {}),
      };
      plugin.app.workspace.trigger = vi.fn();
      const root = document.body.createDiv();
      const cleanup = renderTagDefaultsControl(root, plugin);
      const input = root.querySelector<HTMLInputElement>("input[type=color]")!;
      input.value = "#111111";
      input.dispatchEvent(new Event("input"));
      expect(plugin.saveSettings).not.toHaveBeenCalled();
      expect(settings.defaultTagColor).toBeUndefined();
      const button = Array.from(root.querySelectorAll("button")).find(
        (el) =>
          el.textContent ===
          (futureOnly ? "Future tags only" : "Inherited and future tags"),
      )!;
      button.click();
      await vi.waitFor(() =>
        expect(plugin.saveSettings).toHaveBeenCalledOnce(),
      );
      expect(
        resolveTagAppearance(settings.availableTags[0], settings).background,
      ).toBe(futureOnly ? "#8a5cf5" : "#111111");
      expect(resolveTagAppearance(settings.availableTags[1], settings)).toEqual(
        { background: "#123456", text: "#abcdef" },
      );
      expect(
        resolveTagAppearance({ name: "Future" }, settings).background,
      ).toBe("#111111");
      cleanup();
    },
  );
});
