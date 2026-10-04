import type { FeedItem } from "../types/types";
import type { DashellLearning } from "./controller";
import type { Material, Mode } from "./model";
import { articleFragment } from "./content";
import { stableId, safeUrl } from "./safety";
import { usesRssMediaPreview } from "./preview-routing";
import { setIcon, setTooltip } from "obsidian";

function action(
  parent: HTMLElement,
  label: string,
  controller: DashellLearning,
  work: () => Promise<void>,
): void {
  const button = parent.createEl("button", { text: label });
  button.addEventListener("click", () => {
    button.disabled = true;
    void controller.act(work).finally(() => {
      button.disabled = false;
    });
  });
}
function controls(
  parent: HTMLElement,
  item: FeedItem,
  material: Material | undefined,
  controller: DashellLearning,
): void {
  parent.empty();
  const actions = parent.createDiv({ cls: "rss-dashell-learning-actions" });
  const localReady = material
    ? controller.importer.localReady(material)
    : false;
  if (material && ["queued", "downloading"].includes(material.download)) {
    actions.createSpan({
      text: material.download === "queued" ? "等待下载…" : "正在下载…",
    });
    action(actions, "取消下载", controller, () =>
      controller.importer.cancel(material.id),
    );
  } else {
    action(
      actions,
      localReady ? "打开学习" : "下载到本地学习",
      controller,
      async () => {
        const record = await controller.ensure(item);
        if (controller.importer.localReady(record))
          await controller.learning.open(record.id);
        else await controller.importer.enqueue(record.id);
      },
    );
    if (material?.error)
      action(actions, "重新下载", controller, async () => {
        const record = await controller.ensure(item);
        await controller.importer.enqueue(record.id);
      });
  }
  const session = material?.sessions[material.sessions.length - 1];
  if (material && session && !session.completed)
    action(actions, "完成本轮", controller, () =>
      controller.learning.finish(material.id),
    );
  if (session?.completed)
    actions.createSpan({
      cls: "rss-dashell-learning-status",
      text: "本轮已完成，打开可开始新一轮。",
    });
  if (material?.error)
    parent.createDiv({
      cls: "rss-dashell-learning-error",
      text: material.error,
      attr: { role: "alert" },
    });
  if (item.dashell?.assets?.length)
    parent.createDiv({
      cls: "rss-dashell-learning-status",
      text: `素材包包含 ${item.dashell.assets.length} 个文件；必要文件全部下载成功后才可学习。`,
    });
}
export function versionControls(
  panel: HTMLElement,
  container: HTMLElement,
  item: FeedItem,
): () => void {
  const body = container.querySelector<HTMLElement>(
    ".rss-reader-article-content",
  );
  if (!body) return () => undefined;
  const originalNodes = Array.from(body.childNodes);
  const slot = container
    .closest(".rss-dashell-reader")
    ?.querySelector<HTMLElement>(".rss-dashell-reader-version-slot");
  const host =
    slot ?? panel.createDiv({ cls: "rss-dashell-reader-version-slot" });
  host.empty();
  const label = host.createEl("label", {
    text: "阅读版本",
    cls: "rss-dashell-mode-label",
  });
  const select = label.createEl("select", { cls: "rss-dashell-reader-mode" });
  const variants: { mode: Mode; label: string; content?: string }[] = [
    { mode: "original", label: "原文" },
  ];
  if (item.dashell?.translation)
    variants.push({
      mode: "translation",
      label: "译文",
      content: item.dashell.translation,
    });
  if (item.dashell?.rewrite)
    variants.push({
      mode: "rewrite",
      label: "改写",
      content: item.dashell.rewrite,
    });
  for (const variant of variants)
    select.createEl("option", { value: variant.mode, text: variant.label });
  select.disabled = variants.length === 1;
  select.addEventListener("change", () => {
    const variant = variants.find((value) => value.mode === select.value);
    if (!variant) return;
    if (variant.mode === "original") body.replaceChildren(...originalNodes);
    else
      body.replaceChildren(
        articleFragment(
          variant.content ?? "",
          variant.mode,
          container.ownerDocument,
          false,
          item.link || undefined,
        ),
      );
    container.scrollTop = 0;
  });
  return () => {
    label.remove();
    if (!slot) host.remove();
  };
}
export function mountLearningPanel(
  container: HTMLElement,
  item: FeedItem,
  controller?: DashellLearning,
): () => void {
  if (!controller || usesRssMediaPreview(item)) return () => undefined;
  const slot = container.closest(".rss-workbench")?.querySelector<HTMLElement>(".rss-dashell-learning-slot");
  const dropdown = slot?.createEl("details", { cls: "rss-dashell-learning-menu" });
  if (dropdown) {
    const summary = dropdown.createEl("summary", { cls: "rss-dashell-reader-icon" });
    setIcon(summary, "graduation-cap");
    setTooltip(summary, "下载与学习");
  }
  const panel = (dropdown ?? container).createDiv({ cls: "rss-dashell-learning-panel" });
  if (!slot) container.prepend(panel);
  const controlsEl = panel.createDiv();
  const clearVersions = versionControls(panel, container, item);
  let id = "";
  let disposed = false;
  const render = () => {
    if (!disposed)
      controls(
        controlsEl,
        item,
        controller.store.state.materials.find((item) => item.id === id),
        controller,
      );
  };
  const unsubscribe = controller.store.subscribe(render);
  render();
  const identity =
    item.dashell?.id ||
    safeUrl(item.link, item.feedUrl) ||
    `${item.feedUrl}\n${item.guid || item.title}`;
  void controller.act(async () => {
    id = await stableId(identity);
    render();
  });
  return () => {
    disposed = true;
    unsubscribe();
    clearVersions();
    panel.remove();
    dropdown?.remove();
  };
}
