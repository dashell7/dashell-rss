import {
  isLikelySameImageSource,
  removeLeadImageElement,
} from "../../utils/reader-html-cleanup";
import { normalizeSubstackImageUrl } from "../../utils/substack-image-url";
/** File names too common to say two images are the same picture. */
const GENERIC_IMAGE_FILE_NAMES = new Set([
  "image",
  "img",
  "photo",
  "picture",
  "thumbnail",
  "thumb",
  "cover",
  "hero",
  "header",
  "banner",
  "featured",
  "default",
  "placeholder",
  "logo",
  "social",
  "share",
]);

/** An image's file name without extension or WordPress size suffix, lowercased. */
function imageFileStem(rawUrl: string): string {
  let path = rawUrl;
  try {
    path = new URL(rawUrl, "https://example.invalid").pathname;
  } catch {
    // A malformed URL falls back to the raw text.
  }
  const fileName = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const sized = stem.lastIndexOf("-");
  const suffix = sized > 0 ? stem.slice(sized + 1) : "";
  return /^\d+x\d+$/.test(suffix) ? stem.slice(0, sized) : stem;
}

/**
 * Whether a body image is `{{image}}` in another size or behind a resizer:
 * the same host and path, or else a distinctive file name. A generic name such
 * as `image.jpg` does not count, because unrelated pictures share it.
 */
function isTemplateImage(bodyImageUrl: string, templateImage: string): boolean {
  if (isLikelySameImageSource(bodyImageUrl, templateImage)) return true;
  const stem = imageFileStem(templateImage);
  return (
    stem.length >= 6 &&
    !GENERIC_IMAGE_FILE_NAMES.has(stem) &&
    stem === imageFileStem(bodyImageUrl)
  );
}

/**
 * Removes the first image in the body HTML that is `{{image}}`, so a template
 * that places the image itself shows it once, as Web Clipper's does. The hero
 * check in {@link bodyLeadsWithHero} cannot do it: the body's copy usually has
 * a different size or resizer path. Returns the HTML untouched when nothing
 * matches.
 */
export function removeTemplateImageFromBody(
  html: string,
  templateImage: string,
): string {
  if (!html || !templateImage) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const match = Array.from(doc.body.querySelectorAll("img")).find((img) =>
      isTemplateImage(
        normalizeSubstackImageUrl(img.getAttribute("src") || ""),
        templateImage,
      ),
    );
    if (!match) return html;
    removeLeadImageElement(match);
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
