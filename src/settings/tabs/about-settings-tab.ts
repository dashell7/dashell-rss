/**
 * About Settings Tab renderer.
 *
 * Extracted from the monolithic settings-tab.ts.
 * Exports:
 *   - renderAboutTab(containerEl, plugin)
 */
import { Notice, setIcon, setTooltip } from "obsidian";
import RssDashboardPlugin from "../../../main";
import supportQrImage from "../../assets/about/dashell-support-qr.jpg";
import wechatQrImage from "../../assets/about/dashell-wechat-qr.jpg";
import { formatBuildLabel, getBuildInfo } from "../../utils/build-info";
import { WhatsNewModal } from "../../modals/whats-new-modal";
import { getReleaseNoteForVersion } from "../../release-notes";

function renderMaintainer(containerEl: HTMLElement, plugin: RssDashboardPlugin): void {
  const paragraph = containerEl.createEl("p", { text: "作者：" });
  const link = paragraph.createEl("a", {
    text: plugin.manifest.author || "dashell",
    href: plugin.manifest.authorUrl || "https://github.com/dashell7",
    cls: "rss-dashboard-about-link",
  });
  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

function renderDashellContacts(containerEl: HTMLElement): void {
  const contactList = containerEl.createDiv({
    cls: "rss-dashboard-about-contact-list",
  });
  const addContact = (label: string, value: string, href?: string): void => {
    const row = contactList.createDiv({ cls: "rss-dashboard-about-contact" });
    row.createSpan({ text: label });
    const valueEl = href
      ? row.createEl("a", { text: value, href, cls: "rss-dashboard-about-contact-value" })
      : row.createSpan({ text: value, cls: "rss-dashboard-about-contact-value" });
    if (valueEl.instanceOf(HTMLAnchorElement)) {
      valueEl.target = "_blank";
      valueEl.rel = "noopener noreferrer";
    }
  };

  addContact("邮箱", "dashell7@gmail.com", "mailto:dashell7@gmail.com");
  addContact("X", "@dashell77", "https://x.com/dashell77");
  addContact("GitHub", "@dashell7", "https://github.com/dashell7");
  addContact("微信", "Adashell");
}

function renderAboutQrSection(
  containerEl: HTMLElement,
  title: string,
  description: string,
  src: string,
  alt: string,
): void {
  const row = containerEl.createDiv({ cls: "rss-dashboard-about-qr" });
  const copy = row.createDiv({ cls: "rss-dashboard-about-qr-copy" });
  copy.createDiv({ text: title, cls: "rss-dashboard-about-qr-title" });
  copy.createDiv({ text: description, cls: "rss-dashboard-about-qr-description" });
  row.createEl("img", {
    cls: "rss-dashboard-about-qr-image",
    attr: { src, alt, width: "160", height: "160", loading: "lazy" },
  });
}

function renderProjectDescription(
  containerEl: HTMLElement,
  plugin: RssDashboardPlugin,
): void {
  containerEl.createEl("p", {
    text: "Dashell RSS 由 dashell 维护，保留 RSS dashboard 的订阅与媒体预览体验，并与 Dashell Reader、Dashell Player 协同工作。",
  });

  const featuresList = containerEl.createEl("ul", {
    cls: "rss-dashboard-about-features-list",
  });
  featuresList.createEl("li", { text: "订阅、阅读状态和学习资料保存在本地库中。" });
  featuresList.createEl("li", {
    text: "文章可保存到库中并交由 Dashell Reader 阅读；播客和视频继续使用 RSS 预览。",
  });
  featuresList.createEl("li", { text: "开源项目，不含广告或付费墙。" });

  renderMaintainer(containerEl, plugin);
  const attributionParagraph = containerEl.createEl("p");
  attributionParagraph.createSpan({ text: "本插件基于 RSS Dashboard。上游项目由 " });
  const originalCreatorLink = attributionParagraph.createEl("a", {
    text: "Amatya-aditya",
    href: "https://github.com/amatya-aditya/",
    cls: "rss-dashboard-about-link",
  });
  originalCreatorLink.target = "_blank";
  originalCreatorLink.rel = "noopener noreferrer";
  attributionParagraph.createSpan({ text: " 创建，后由 " });
  const maintainerLink = attributionParagraph.createEl("a", {
    text: "Marcd35",
    href: "https://github.com/marcd35",
    cls: "rss-dashboard-about-link",
  });
  maintainerLink.target = "_blank";
  maintainerLink.rel = "noopener noreferrer";
  attributionParagraph.createSpan({ text: " 自 2.2.0 版起持续维护，并感谢社区贡献者。" });
}

export function renderAboutTab(
  containerEl: HTMLElement,
  plugin: RssDashboardPlugin,
): void {
  const aboutContainer = containerEl.createDiv({
    cls: "rss-dashboard-about-tab",
  });

  aboutContainer.createDiv({
    cls: "rss-dashboard-about-title",
    text: plugin.manifest.name,
  });
  aboutContainer.createDiv({
    cls: "rss-dashboard-about-version",
    text: `v${plugin.manifest.version}`,
  });

  const buildLabel = formatBuildLabel(plugin.manifest.version, getBuildInfo());
  const buildRow = aboutContainer.createDiv({
    cls: "rss-dashboard-about-build",
  });
  buildRow.createSpan({
    cls: "rss-dashboard-about-build-label",
    text: buildLabel,
  });
  const copyBuildButton = buildRow.createEl("button", {
    cls: "rss-dashboard-about-build-copy clickable-icon",
    attr: { type: "button" },
  });
  setIcon(copyBuildButton, "copy");
  setTooltip(copyBuildButton, "Copy build details");
  copyBuildButton.onclick = () => {
    void navigator.clipboard.writeText(buildLabel).then(() => {
      new Notice("Build details copied");
    });
  };

  const releaseNote = getReleaseNoteForVersion(plugin.manifest.version);
  if (releaseNote) {
    const whatsNewRow = aboutContainer.createDiv({
      cls: "rss-dashboard-about-btn-row rss-dashboard-about-whats-new-row",
    });
    const whatsNewButton = whatsNewRow.createEl("button", {
      text: `What's new in v${plugin.manifest.version}?`,
      cls: "rss-dashboard-about-btn",
    });
    whatsNewButton.onclick = () => {
      new WhatsNewModal(plugin.app, plugin.manifest.version, releaseNote).open();
    };
  }

  const descriptionContainer = aboutContainer.createDiv({
    cls: "rss-dashboard-about-description",
  });
  renderProjectDescription(descriptionContainer, plugin);

  const createLinkButton = (
    parent: HTMLElement,
    label: string,
    href: string,
  ): void => {
    const link = parent.createEl("a", {
      text: label,
      href,
      cls: "rss-dashboard-about-btn",
    });
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  };

  const actionsRow = aboutContainer.createDiv({
    cls: "rss-dashboard-about-btn-row",
  });
  createLinkButton(actionsRow, "项目仓库", "https://github.com/dashell7/dashell-rss");
  createLinkButton(actionsRow, "更新记录", "https://github.com/dashell7/dashell-rss/releases");
  createLinkButton(actionsRow, "使用说明", "https://github.com/dashell7/dashell-rss#readme");
  createLinkButton(actionsRow, "许可证", "https://github.com/dashell7/dashell-rss/blob/codex/dashell-rss-upstream-sync/LICENSE");

  aboutContainer.createDiv({
    cls: "rss-dashboard-about-section-title",
    text: "问题反馈",
  });
  const feedbackRow = aboutContainer.createDiv({
    cls: "rss-dashboard-about-btn-row",
  });
  createLinkButton(feedbackRow, "报告问题或提出建议", "https://github.com/dashell7/dashell-rss/issues");

  renderDashellContacts(aboutContainer);
  aboutContainer.createDiv({
    cls: "rss-dashboard-about-section-title",
    text: "打赏支持",
  });
  renderAboutQrSection(aboutContainer, "支持 dashell7", "感谢支持 Dashell 插件持续维护。", supportQrImage, "dashell7 赞赏码");
  aboutContainer.createDiv({
    cls: "rss-dashboard-about-section-title",
    text: "关注公众号",
  });
  renderAboutQrSection(aboutContainer, "Dashell 公众号", "扫码关注公众号。", wechatQrImage, "Dashell 微信公众号二维码");

  aboutContainer.createDiv({
    cls: "rss-dashboard-about-section-title",
    text: "支持 RSS Dashboard 上游",
  });
  const supportRow = aboutContainer.createDiv({
    cls: "rss-dashboard-about-btn-row",
  });
  createLinkButton(
    supportRow,
    "Buy me a coffee",
    "https://www.buymeacoffee.com/amatya_aditya",
  );
  createLinkButton(supportRow, "Ko-fi", "https://ko-fi.com/Y8Y41FV4WI");

  aboutContainer.createDiv({
    cls: "rss-dashboard-about-section-title",
    text: "Dashell 的其他插件",
  });
  const otherPluginsRow = aboutContainer.createDiv({
    cls: "rss-dashboard-about-btn-row",
  });
  createLinkButton(
    otherPluginsRow,
    "Dashell Reader",
    "https://github.com/dashell7/dashell-reader",
  );
  createLinkButton(
    otherPluginsRow,
    "Dashell Player",
    "https://github.com/dashell7/dashell-player",
  );
}
