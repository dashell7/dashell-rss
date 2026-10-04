import { describe, expect, it } from "vitest";
import { articleFileNames } from "../../../src/dashell/article-filenames";

describe("article filenames", () => {
  it("names original, translated and rewritten articles by their title", () => {
    expect(articleFileNames("A useful lesson")).toEqual({
      original: "A useful lesson.md",
      translation: "A useful lesson - 译文.md",
      rewrite: "A useful lesson - 改写.md",
    });
  });
  it.each(["CON", "LPT1", "nul.txt", " ../a:b/[c]#d^e?* \u0000", "...", ""])(
    "makes the title %j safe for vault filenames and internal links", title => {
      for (const name of Object.values(articleFileNames(title))) {
        expect(name).toMatch(/.+\.md$/);
        expect(name).not.toMatch(/^[. ]|[<>:"/\\|?*#[\]^]/);
        expect(name).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i);
        expect(Array.from(name).every(char => char.charCodeAt(0) >= 32)).toBe(true);
      }
    },
  );
  it("keeps long multilingual names within filesystem limits without splitting characters", () => {
    for (const title of ["阅读".repeat(100), "a" + "😀".repeat(100), "a".repeat(99) + "😀"]) {
      for (const name of Object.values(articleFileNames(title))) {
        expect(new TextEncoder().encode(name).length).toBeLessThan(200);
        expect(new TextDecoder().decode(new TextEncoder().encode(name))).toBe(name);
      }
    }
  });
});
