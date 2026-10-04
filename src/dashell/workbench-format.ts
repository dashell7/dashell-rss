import type { ReaderFormatSettings } from "../types/types";
import { setCssProps } from "../utils/platform-utils";

export function applyWorkbenchFormat(
  root: HTMLElement,
  format: ReaderFormatSettings,
): void {
  const fonts: Record<ReaderFormatSettings["fontFamily"], string> = {
    default: "var(--font-text)",
    serif: '"Songti SC", "SimSun", Georgia, serif',
    sans: "var(--font-interface)",
    mono: "var(--font-monospace)",
  };
  setCssProps(root, {
    "--rss-workbench-font-size": `${(19 * format.fontScalePct) / 100}px`,
    "--rss-workbench-line-height": String(format.lineHeightPct / 100),
    "--rss-workbench-font-family": fonts[format.fontFamily] || fonts.default,
    "--rss-workbench-text-width": `${(684 * format.paragraphWidth) / 100}px`,
  });
  root.dataset.rssReaderAlign = format.textAlign;
  root.dataset.rssReaderParagraph = format.paragraphSpacing;
}
