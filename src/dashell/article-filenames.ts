import { sanitizeFilename } from "../services/article-saver";
import type { Mode } from "./model";

/** Article variants share a readable title; their dedicated folder isolates collisions. */
export function articleFileNames(title: string): Record<Mode, string> {
  const characters = Array.from(sanitizeFilename(title))
    .filter(char => {
      const code = char.codePointAt(0)!;
      // The shared 100-character sanitizer can cut a surrogate pair in half.
      return code >= 32 && code !== 127 && (code < 0xd800 || code > 0xdfff);
    });
  // Leave room for suffixes on filesystems that limit names by UTF-8 bytes.
  while (new TextEncoder().encode(characters.join("")).length > 180) characters.pop();
  let name = characters.join("").replace(/[[\]#^]/g, "-").replace(/^[. ]+|[. ]+$/g, "") || "未命名文章";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  return { original: `${name}.md`, translation: `${name} - 译文.md`, rewrite: `${name} - 改写.md` };
}
