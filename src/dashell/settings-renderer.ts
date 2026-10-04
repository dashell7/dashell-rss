import { Setting } from "obsidian";
import type { DashellLearning } from "./controller";
import { safeFolder } from "./safety";

export function renderLearningSettings(
  container: HTMLElement,
  controller?: DashellLearning,
): void {
  if (!controller) {
    container.createEl("p", {
      text: "学习数据未能加载，原有订阅仍可使用。请检查插件数据或备份。",
    });
    return;
  }
  new Setting(container).setName("本地学习资料").setHeading();
  new Setting(container)
    .setName("下载目录")
    .setDesc("保存主文件、配套字幕和来源笔记；已有资料不会搬动。")
    .addText((text) => {
      text.setValue(controller.store.state.preferences.folder);
      text.onChange((value) => {
        void controller.act(async () => {
          let folder: string;
          try {
            folder = safeFolder(value);
          } catch {
            return;
          }
          await controller.store.transact((next) => {
            next.preferences.folder = folder;
          });
        });
      });
    });
  new Setting(container)
    .setName("单个文件大小上限（MB）")
    .setDesc("默认 64 MB。当前使用宿主内存缓冲，暂不支持断点续传。")
    .addText((text) => {
      text.setValue(String(controller.store.state.preferences.maxFileMB));
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "512";
      text.onChange((value) => {
        const limit = Number(value);
        if (Number.isFinite(limit) && limit >= 1 && limit <= 512)
          void controller.act(() =>
            controller.store.transact((next) => {
              next.preferences.maxFileMB = limit;
            }),
          );
      });
    });
  new Setting(container).setName("学习衔接").setHeading();
  new Setting(container)
    .setName("Dashell Reader / Dashell Player")
    .setDesc(
      "点击文章自动保存并用阅读器打开；音视频交给播放器。再次打开复用本地资料和阅读进度。",
    );
  new Setting(container)
    .setName("复习")
    .setDesc("查词、生词和 Spaced Repetition 复习沿用学习插件的设置。");
  new Setting(container)
    .setName("下载取消")
    .setDesc("取消后停止后续文件写入；宿主不能中止已发出的网络请求。");
}
