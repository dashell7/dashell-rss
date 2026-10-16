import { afterEach, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { SettingsSaveQueue } from "../../../src/services/settings-save-queue";
import { SettingsStore } from "../../../src/services/settings-store";
import { FeedStorageRepository } from "../../../src/services/feed-storage-repository";
import { AutoBackupCoordinator } from "../../../src/services/auto-backup-coordinator";
import { DEFAULT_SETTINGS, type Feed, type RssDashboardSettings, type UserStateFile } from "../../../src/types/types";

afterEach(() => vi.restoreAllMocks());

it("finishes an earlier write before persisting the latest burst of settings", async () => {
  let release!: () => void;
  const stored: number[] = [];
  const write = vi.fn(async (settings: { value: number }, _options: unknown) => {
    if (!stored.length) await new Promise<void>(resolve => { release = resolve; });
    stored.push(settings.value);
  });
  const queue = new SettingsSaveQueue(write, settings => ({ ...settings }));
  const settings = { value: 1 };
  const first = queue.save(settings, {});
  await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
  settings.value = 2;
  const second = queue.save(settings, { forceMetadata: true });
  settings.value = 3;
  const third = queue.save(settings, { forceAllShards: true });
  release();
  await Promise.all([first, second, third]);
  expect(stored).toEqual([1, 3]);
  expect(write.mock.calls[1]?.[1]).toEqual({
    replacesFeedList: undefined, forceMetadata: true, forceAllShards: true,
  });
});

it("keeps restored settings in order and continues after a failed write", async () => {
  const failure = new Error("disk unavailable");
  const stored: string[] = [];
  const write = vi.fn(async (settings: { name: string }) => {
    if (settings.name === "old") throw failure;
    stored.push(settings.name);
  });
  const queue = new SettingsSaveQueue(write);
  const first = queue.save({ name: "old" }, {}).catch(error => error);
  const restored = queue.save({ name: "restored" }, { replacesFeedList: true });
  await expect(first).resolves.toBe(failure);
  await restored;
  expect(stored).toEqual(["restored"]);
  await queue.save({ name: "edited" }, {});
  expect(stored).toEqual(["restored", "edited"]);
});

function feed(id: string): Feed {
  return {
    feedId: id, title: id, url: `https://example.org/${id}`, folder: "QA", lastUpdated: 1,
    items: [{
      guid: `${id}-article`, title: id, link: `https://example.org/${id}/article`,
      feedUrl: `https://example.org/${id}`, feedTitle: id, coverImage: "",
      description: "cached", pubDate: "", read: true, starred: true, tags: [],
    }],
  };
}

it("persists a deletion during an in-flight save without resurrecting its shard or losing surviving article state", async () => {
  const app = App.createMock();
  let settings: RssDashboardSettings = {
    ...structuredClone(DEFAULT_SETTINGS), storageMode: "vault-shards-v2",
    storageFolder: "QA/feeds", metadataStorageMode: "plugin-default", metadataStorageFolder: "QA",
    feeds: [feed("removed"), feed("kept")],
  };
  const repository = new FeedStorageRepository(app);
  let metadata: RssDashboardSettings | undefined;
  const store = new SettingsStore(app, {
    manifest: { id: "dashell-rss", name: "Dashell RSS", version: "2.7.4", minAppVersion: "1.8.7", author: "test", description: "test" },
    feedStorageRepository: repository,
    autoBackupCoordinator: new AutoBackupCoordinator({ writeSnapshot: async () => {} }),
    getSettings: () => settings, setSettings: value => { settings = value; },
    loadData: async () => metadata,
    saveData: async value => { metadata = structuredClone(value as RssDashboardSettings); },
    loadSettings: async () => {}, saveSettings: async () => {},
    migrateLegacySettings: () => false, repairMissingFolderPathsForFeeds: async () => {},
    hasFolderService: () => false, hasBackupService: () => true,
    bindSettingsBackedServices: () => {}, initializeSettingsBackedServices: () => {},
    getAutoRefreshScheduler: () => null, refreshDashboardViews: async () => {},
  });
  await store.saveSettings();
  let release!: () => void;
  let blocked = false;
  const originalWrite = app.vault.adapter.write.bind(app.vault.adapter);
  vi.spyOn(app.vault.adapter, "write").mockImplementation(async (path, data) => {
    if (path === "QA/feeds/removed.json" && !blocked) {
      blocked = true;
      await new Promise<void>(resolve => { release = resolve; });
    }
    await originalWrite(path, data);
  });
  settings.feeds[0].items[0].description = "updated before deletion";
  const earlier = store.saveSettings();
  await vi.waitFor(() => expect(blocked).toBe(true));
  settings.feeds.splice(0, 1);
  settings.feeds[0].items[0].starred = false;
  const deletion = store.saveSettings();
  release();
  await Promise.all([earlier, deletion]);
  expect(metadata?.feeds.map(value => value.feedId)).toEqual(["kept"]);
  expect(await app.vault.adapter.exists("QA/feeds/removed.json")).toBe(false);
  const state = JSON.parse(await app.vault.adapter.read("QA/user-state.json")) as UserStateFile;
  expect(Object.keys(state.states)).toHaveLength(1);
  expect(Object.values(state.states)[0]).toMatchObject({ read: true, starred: false });
  const restart = structuredClone(metadata!);
  await new FeedStorageRepository(app).hydrateSettings(restart);
  expect(restart.feeds.map(value => value.feedId)).toEqual(["kept"]);
  expect(restart.feeds[0]?.items[0]).toMatchObject({ read: true, starred: false });
});
