import { Notice, Setting } from "obsidian";
import type { App, ButtonComponent } from "obsidian";
import type { RssDashboardSettings } from "../../types/types";
interface TagDefaultsHost {
  app: App;
  settings: RssDashboardSettings;
  saveSettings(): Promise<void>;
  refreshOpenTagColorViews(): Promise<void>;
}
import { addTagColorPaletteControl } from "../../components/tag-color-palette-control";
import { addRandomizeColorButton } from "../../components/tag-color-randomize-button";
import {
  applyTagAppearance,
  DEFAULT_TAG_COLOR,
  DEFAULT_TAG_TEXT_COLOR,
} from "../../utils/tag-colors";
import { applyTagDefaults } from "../../utils/tag-defaults";

/** Editing is a draft until the user chooses which tags should inherit it. */
export function renderTagDefaultsControl(
  container: HTMLElement,
  plugin: TagDefaultsHost,
): () => void {
  new Setting(container).setName("Default tag appearance").setHeading();
  const panel = container.createDiv({ cls: "rss-dashboard-tag-defaults" });
  const preview = panel.createSpan({
    cls: "rss-dashboard-tag-badge",
    text: "Preview",
  });
  const cleanups: Array<() => void> = [];
  const inputs: HTMLInputElement[] = [];
  const refresh = () =>
    applyTagAppearance(
      preview,
      { name: "Preview" },
      {
        availableTags: [],
        defaultTagColor: inputs[0]?.value,
        defaultTagTextColor: inputs[1]?.value,
      },
    );
  for (const [name, value] of [
    ["Background", plugin.settings.defaultTagColor ?? DEFAULT_TAG_COLOR],
    ["Text", plugin.settings.defaultTagTextColor ?? DEFAULT_TAG_TEXT_COLOR],
  ] as const) {
    const row = panel.createDiv({ cls: "rss-dashboard-tag-default-row" });
    row.createSpan({ text: name });
    const input = row.createEl("input", {
      attr: {
        type: "color",
        "aria-label": `Default tag ${name.toLowerCase()}`,
      },
    });
    input.value = value ?? "";
    inputs.push(input);
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    addRandomizeColorButton({ input, parent: row });
    const cleanup = addTagColorPaletteControl({
      container: row,
      input,
      fieldName: name ?? "Color",
    });
    cleanups.push(cleanup);
  }
  refresh();
  let saving = false;
  const buttons: ButtonComponent[] = [];
  const save = async (futureOnly: boolean) => {
    if (saving) return;
    saving = true;
    buttons.forEach((button) => {
      button.buttonEl.disabled = true;
    });
    try {
      applyTagDefaults(
        plugin.settings,
        { background: inputs[0]!.value, text: inputs[1]!.value },
        futureOnly,
      );
      await plugin.saveSettings();
      await plugin.refreshOpenTagColorViews();
      plugin.app.workspace.trigger("rss-dashboard:tags-mutated");
    } catch (error) {
      console.error("Could not finish saving tag defaults", error);
      new Notice("Could not finish saving tag defaults. Please retry.");
    } finally {
      saving = false;
      buttons.forEach((button) => {
        button.buttonEl.disabled = false;
      });
    }
  };
  new Setting(panel)
    .setName("Apply draft colors")
    .setDesc(
      "Custom tag overrides are preserved. Future only keeps existing tags looking the same.",
    )
    .addButton((button) => {
      buttons.push(button);
      button
        .setButtonText("Inherited and future tags")
        .onClick(() => save(false));
    })
    .addButton((button) => {
      buttons.push(button);
      button.setButtonText("Future tags only").onClick(() => save(true));
    });
  return () => cleanups.forEach((cleanup) => cleanup());
}
