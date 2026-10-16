import { afterEach, expect, it } from "vitest";
import { CustomXMLParser } from "../../../../src/services/feed-parser/xml-parser/custom-xml-parser";

afterEach(() => document.body.empty());
it("keeps Atom article fields independent of media attachments and nested HTML", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><title>Feed</title><entry><media:content>photo.jpg</media:content><media:title>Wrong</media:title><title>Article</title><id>1</id><content type="html">&lt;p&gt;Real article&lt;/p&gt;</content><link rel="alternate" href="https://example.org/1"/></entry></feed>`;
  const result = new CustomXMLParser().parseString(xml);
  expect(result.items[0].title).toBe("Article");
  expect(result.items[0].content).toBe("<p>Real article</p>");
});
it("reads prefixed Atom feeds and XHTML content", () => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom"><a:title>Feed</a:title><a:entry><a:title>Article</a:title><a:id>1</a:id><a:content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Text <strong>kept</strong></p></div></a:content></a:entry></a:feed>`;
  const result = new CustomXMLParser().parseString(xml);
  expect(result.type).toBe("atom");
  expect(result.items[0].title).toBe("Article");
  expect(result.items[0].content).toContain("<strong>kept</strong>");
});
