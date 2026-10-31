import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "../../../src/services/article-saver";
import { stripTitleFormattingTags } from "../../../src/services/feed-parser/xml-parser/xml-html-utils";

describe("Dashboard beta2 parsing and saved names", () => {
  it("preserves long ASCII titles and fits multilingual names in 255 UTF-8 bytes", () => {
    expect(sanitizeFilename("a".repeat(260))).toBe("a".repeat(245));
    for (const title of ["中文".repeat(150), "😀".repeat(150), "name" + "\ud800"]) {
      const stem = sanitizeFilename(title);
      expect(new TextEncoder().encode(stem + ".md").length).toBeLessThanOrEqual(255);
      expect(new TextDecoder().decode(new TextEncoder().encode(stem))).toBe(stem);
    }
    expect(sanitizeFilename("[note]#topic^. ")).toBe("notetopic");
    expect(sanitizeFilename("CON")).toBe("Untitled Article");
  });
  it("strips paired title markup and retains literal or malformed angle brackets", () => {
    expect(stripTitleFormattingTags('<em class="x">Wicker</em><br/>Park')).toBe("Wicker Park");
    expect(stripTitleFormattingTags('<a href="x>y">Link</a>')).toBe("Link");
    for (const title of ["INumber<T>", "Why 3 < 4", "<b>literal", "<i !!! ".repeat(10000)]) {
      expect(stripTitleFormattingTags(title)).toBe(title.trim());
    }
  });
});
