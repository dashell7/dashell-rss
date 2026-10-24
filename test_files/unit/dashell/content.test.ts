import { describe, expect, it } from "vitest";
import { marked } from "marked";
import { articleFragment } from "../../../src/dashell/content";

describe("Dashell rewrite images", () => {
  it.each([
    ["![[image](https://example.com/a.png)", "https://example.com/a.png", "[image"],
    ["![[Image preview](https://example.com/b.png)", "https://example.com/b.png", "[Image preview"],
    ["![[image](https://example.com/image(2).png)", "https://example.com/image(2).png", "[image"],
    ["![[image](https://substackcdn.com/image/fetch/$s_!rRsx!,w_1456,c_limit,f_auto,q_auto:good/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fexample.png)", "https://substackcdn.com/image/fetch/$s_!rRsx!,w_1456,c_limit,f_auto,q_auto:good/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fexample.png", "[image"],
  ])("recovers a standalone malformed image: %s", (markdown, src, alt) => {
    const fragment = articleFragment(markdown, "rewrite", document, true);
    expect(fragment.querySelectorAll("img")).toHaveLength(1);
    expect(fragment.querySelector("img")?.getAttribute("src")).toBe(src);
    expect(fragment.querySelector("img")?.getAttribute("alt")).toBe(alt);
    expect(fragment.textContent?.trim()).toBe("");
  });

  it("keeps balanced and escaped alt brackets and ordinary images valid", () => {
    const fragment = articleFragment(
      "![[AINews] DeepInfer](https://example.com/a.png)\n\n![\\[escaped](https://example.com/b.png)\n\n![ordinary](https://example.com/c.png)",
      "rewrite", document, true,
    );
    expect(Array.from(fragment.querySelectorAll("img"), img => img.getAttribute("alt")))
      .toEqual(["[AINews] DeepInfer", "[escaped", "ordinary"]);
  });

  it("preserves code, Obsidian embeds, inline text and ordinary links", () => {
    const markdown = '```md\n![[image](https://example.com/code.png)\n```\n\n`![[image](https://example.com/inline-code.png)`\n\n![[local.png]]\n\nBefore ![[image](https://example.com/inline.png) after.\n\n[ordinary](https://example.com/story)';
    const fragment = articleFragment(markdown, "rewrite", document, true);
    expect(fragment.querySelectorAll("img")).toHaveLength(0);
    expect(fragment.querySelector("pre code")?.textContent).toContain("![[image]");
    expect(fragment.querySelectorAll("code")[1]?.textContent).toContain("![[image]");
    expect(fragment.textContent).toContain("![[local.png]]");
    expect(fragment.textContent).toContain("Before");
    expect(fragment.querySelector('a[href="https://example.com/story"]')?.textContent).toBe("ordinary");
  });

  it("honors the existing no-images preview policy without residual image text", () => {
    const fragment = articleFragment("Before.\n\n![[image](https://example.com/a.png)\n\nAfter.", "rewrite", document, false);
    expect(fragment.querySelectorAll("img")).toHaveLength(0);
    expect(fragment.textContent).toContain("Before.");
    expect(fragment.textContent).toContain("After.");
    expect(fragment.textContent).not.toContain("image");
    expect(fragment.querySelectorAll("a")).toHaveLength(0);
  });

  it("escapes recovered alt text before sanitizing the fragment", () => {
    const alt = '[preview & " onerror="alert(1)';
    const fragment = articleFragment(`![${alt}](https://example.com/a.png)`, "rewrite", document, true);
    expect(fragment.querySelector("img")?.getAttribute("alt")).toBe(alt);
    expect(fragment.querySelectorAll("script, [onerror], [onclick]")).toHaveLength(0);
    expect(fragment.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(fragment.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("retains sanitizer protection for script-like recovered attributes", () => {
    const fragment = articleFragment('![[<script>alert("x")</script>](https://example.com/a.png)', "rewrite", document, true);
    expect(fragment.querySelector("img")?.getAttribute("src")).toBe("https://example.com/a.png");
    expect(fragment.querySelectorAll("script, [onerror], [onclick]")).toHaveLength(0);
    expect(fragment.textContent?.trim()).toBe("");
  });

  it.each(["javascript:alert(1)", "data:image/svg+xml,unsafe", "file:///secret.png", "//example.com/a.png"])(
    "does not recover an unsupported image address: %s", url => {
      const fragment = articleFragment(`![[image](${url})`, "rewrite", document, true);
      expect(fragment.querySelectorAll("img")).toHaveLength(0);
      expect(fragment.querySelectorAll('[href^="javascript:"], [src^="data:"], [src^="file:"]')).toHaveLength(0);
    },
  );

  it("does not change the shared Markdown parser or non-rewrite HTML", () => {
    const malformed = "![[image](https://example.com/a.png)";
    const before = marked.parse(malformed, { async: false });
    articleFragment(malformed, "rewrite", document, true);
    expect(marked.parse(malformed, { async: false })).toBe(before);
    const fragment = articleFragment(`<p>${malformed}</p>`, "original", document, true);
    expect(fragment.querySelectorAll("img")).toHaveLength(0);
    expect(fragment.textContent).toBe(malformed);
  });
});
