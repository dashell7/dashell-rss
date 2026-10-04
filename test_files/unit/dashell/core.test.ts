import { afterEach, describe, expect, it, vi } from "vitest";
import { safeUrl, safeFolder } from "../../../src/dashell/safety";
import { readState, emptyState } from "../../../src/dashell/model";
import { CustomXMLParser } from "../../../src/services/feed-parser/xml-parser/custom-xml-parser";
import { materialFor } from "../../../src/dashell/material-adapter";
import { Store } from "../../../src/dashell/store";
import { articleFragment } from "../../../src/dashell/content";
import type { FeedItem } from "../../../src/types/types";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.empty();
});
const sourceItem: FeedItem = {
  title: "Learning",
  guid: "g",
  link: "https://example.com/lesson",
  feedUrl: "https://example.com/rss",
  feedTitle: "Feed",
  description: "<p>Original.</p>",
  pubDate: "",
  coverImage: "",
};
describe("Native RSS learning extension", () => {
  it("preserves ordinary RSS parsing and adds validated bundle metadata", () => {
    const rss =
      '<rss xmlns:dashell="https://dashell.app/rss/1"><channel><title>Feed</title><item><title>Lesson</title><guid>one</guid><description>Hello</description><dashell:id>lesson-001</dashell:id><dashell:asset role="main" extension="mp3" required="true" url="https://example.com/a.mp3"/><dashell:asset role="subtitle" extension="srt" required="true" url="https://example.com/a.srt"/></item></channel></rss>';
    const item = new CustomXMLParser().parseString(rss).items[0];
    expect(item?.title).toBe("Lesson");
    expect(item?.dashell?.id).toBe("lesson-001");
    expect(item?.dashell?.assets).toHaveLength(2);
  });
  it("rejects invalid bundles rather than silently downloading unsafe paths or URLs", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      title: "Feed",
      items: [
        {
          id: "1",
          title: "Invalid",
          content_text: "Text",
          _dashell: {
            assets: [
              {
                role: "main",
                extension: "exe",
                required: true,
                url: "javascript:alert(1)",
              },
            ],
          },
        },
      ],
    });
    expect(() => new CustomXMLParser().parseString(json)).toThrow();
  });
  it("uses the same stable identity across channels with changing URLs", async () => {
    const a = await materialFor({
      ...sourceItem,
      dashell: { id: "server:lesson-1" },
    });
    const b = await materialFor({
      ...sourceItem,
      link: "https://other.example/lesson?version=2",
      feedUrl: "https://other.example/rss",
      dashell: { id: "server:lesson-1" },
    });
    expect(a.id).toBe(b.id);
  });
  it("serializes rapid session changes and does not commit a failed save", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const store = new Store(emptyState(), write);
    const item = await materialFor(sourceItem);
    await expect(
      store.transact((next) => {
        next.materials.push(item);
      }),
    ).rejects.toThrow();
    expect(store.state.materials).toHaveLength(0);
    await store.transact((next) => {
      next.materials.push(item);
    });
    await Promise.all([
      store.changeMaterial(item.id, (item) => {
        item.sessions.push({ started: 1 });
      }),
      store.changeMaterial(item.id, (item) => {
        item.sessions.push({ started: 2 });
      }),
    ]);
    expect(store.state.materials[0]?.sessions).toHaveLength(2);
  });
  it("protects vault paths, future storage and preview HTML", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://user:secret@example.com")).toBeNull();
    expect(() => safeFolder("../outside")).toThrow();
    expect(() => safeFolder("C:/absolute")).toThrow();
    expect(() => readState({ schemaVersion: 999 })).toThrow();
    expect(() => readState({ ...emptyState(), materials: "bad" })).toThrow();
    const fragment = articleFragment(
      '<p onclick="x()">Read <a href="javascript:x()">here</a></p><script>x()</script>',
      "original",
      document,
      false,
    );
    expect(fragment.querySelector("script, [onclick]")).toBeNull();
    expect(fragment.querySelector("a")?.hasAttribute("href")).toBe(false);
  });
});
